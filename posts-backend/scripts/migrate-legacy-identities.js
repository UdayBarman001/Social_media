// One-off migration for the free-text-name -> device-identity switch.
//
// BEFORE this change, Post.author / Comment.author / Like.user /
// Follow.follower / Follow.following stored whatever plain text a device
// had saved as its display name (e.g. "Uday", "Uday Kumar") — literally a
// free-text string, not a reference to anything. AFTER this change those
// fields are real ObjectId refs to User. This script bridges the gap for
// data that already existed before the switch: for every distinct legacy
// string found across those fields, it creates one User document and
// rewrites every document that used that exact string to point at the new
// user's real _id instead.
//
// IMPORTANT LIMITATIONS (also called out in the identity-fix proposal this
// implements — this is a data-quality migration, not an identity/security
// fix):
//   - Two different people who happened to type the same name (e.g. two
//     "Raj"s) get merged into a single User by this script. There is no way
//     to tell them apart after the fact — the plain-text data never
//     recorded which device wrote it. This is a one-time, best-effort
//     merge, not a reversible operation.
//   - Every migrated user is created WITHOUT a deviceId (that field is only
//     set going forward, from features/users/user.service.js#getOrCreateByDevice).
//     A legacy user has no way to "log back in" as themselves after this
//     runs; they'll simply get a brand-new identity next time they open the
//     app, same as any first-time user.
//   - Run this ONCE, after deploying the schema changes, before real
//     traffic starts writing real ObjectIds into these fields. Running it
//     twice is safe (idempotent) — anything that's already a valid ObjectId
//     is left untouched — but pointless the second time.
//
// Usage:  node scripts/migrate-legacy-identities.js

const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../config/database");
const logger = require("../config/logger");

const SOURCES = [
  { collection: "posts", field: "author", single: true },
  { collection: "comments", field: "author", single: true },
  { collection: "likes", field: "user", single: true },
  { collection: "follows", field: "follower", single: true },
  { collection: "follows", field: "following", single: true },
];

function isValidObjectIdString(value) {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

function slugifyHandle(name) {
  const base = (name || "user").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14) || "user";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}_${suffix}`.slice(0, 20);
}

async function run() {
  await connectDB();
  const db = mongoose.connection.db;
  const users = db.collection("users");

  // Repair leftover indexes from before email/password became optional.
  // The User schema now declares `email` as `unique + sparse`, but Mongoose
  // does NOT alter an existing conflicting index to match a schema change —
  // it only creates indexes that don't exist yet. If this collection's
  // `email` index was built back when the field was required (non-sparse
  // unique), every document without an email indexes as `email: null`, and
  // a non-sparse unique index only allows ONE null — so the second legacy
  // user created here would fail with a duplicate-key error that has
  // nothing to do with the handle. Drop and recreate it correctly first.
  const existingIndexes = await users.indexes();
  const emailIndex = existingIndexes.find((idx) => idx.key && idx.key.email === 1);
  if (emailIndex && !emailIndex.sparse) {
    await users.dropIndex(emailIndex.name);
    logger.info(`Dropped non-sparse unique index "${emailIndex.name}" on email.`);
  }
  await users.createIndex({ email: 1 }, { unique: true, sparse: true });

  // 1. Collect every distinct legacy (non-ObjectId) string value across all
  //    five source fields.
  const legacyValues = new Set();
  for (const { collection, field } of SOURCES) {
    const values = await db.collection(collection).distinct(field);
    for (const v of values) {
      if (typeof v === "string" && v.trim() && !isValidObjectIdString(v)) {
        legacyValues.add(v);
      }
    }
  }

  logger.info(`Found ${legacyValues.size} distinct legacy identity string(s) to migrate.`);

  // 2. Create one User per distinct legacy string (best-effort merge — see
  //    file header). Build a string -> new ObjectId map. Reuses an
  //    already-migrated user if this script is being re-run after a
  //    partial failure, instead of creating a duplicate for the same name.
  const idFor = new Map();
  for (const value of legacyValues) {
    const name = value.trim().slice(0, 80) || "Legacy User";

    const alreadyMigrated = await users.findOne({ name, deviceId: { $exists: false } });
    if (alreadyMigrated) {
      idFor.set(value, alreadyMigrated._id);
      continue;
    }

    let handle;
    let created;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      handle = slugifyHandle(value);
      try {
        const result = await users.insertOne({
          name,
          handle,
          // No deviceId — see file header. `sparse` index on deviceId means
          // leaving it unset entirely is fine for any number of these.
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          verified: false,
          bio: "",
          location: null,
          role: "user",
          isEmailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        created = result.insertedId;
      } catch (err) {
        if (err?.code === 11000) continue; // handle collision — retry with a new random suffix
        throw err;
      }
    }
    if (!created) throw new Error(`Could not create a User for legacy value "${value}" after 5 attempts`);
    idFor.set(value, created);
  }

  logger.info(`Created ${idFor.size} User document(s) for legacy identities.`);

  // 3. Rewrite every document that used a legacy string to the new
  //    ObjectId. Post/Comment/Like are simple field updates. Follow needs
  //    per-document handling because remapping two different legacy edges
  //    onto the same (follower, following) pair after the merge above would
  //    violate its unique index — skip (and log) any collision rather than
  //    letting updateMany fail partway through.
  for (const { collection, field } of SOURCES) {
    const coll = db.collection(collection);
    let updated = 0;

    if (collection !== "follows") {
      for (const [value, newId] of idFor) {
        const result = await coll.updateMany({ [field]: value }, { $set: { [field]: newId } });
        updated += result.modifiedCount;
      }
    } else {
      const cursor = coll.find({ [field]: { $type: "string" } });
      for await (const doc of cursor) {
        const newId = idFor.get(doc[field]);
        if (!newId) continue; // already a valid ObjectId string, or somehow missing — leave as-is
        try {
          await coll.updateOne({ _id: doc._id }, { $set: { [field]: newId } });
          updated += 1;
        } catch (err) {
          if (err?.code === 11000) {
            // This follow edge collapsed onto an existing one after the
            // legacy-name merge (e.g. two differently-spelled legacy users
            // both ended up following the same target) — drop the
            // duplicate rather than leaving a half-migrated document.
            await coll.deleteOne({ _id: doc._id });
            logger.warn(`Dropped duplicate follow edge ${doc._id} after identity merge.`);
          } else {
            throw err;
          }
        }
      }
    }

    logger.info(`${collection}.${field}: updated ${updated} document(s).`);
  }

  logger.info("Migration complete.");
  await disconnectDB();
}

run().catch((err) => {
  logger.error("Migration failed", err);
  process.exit(1);
});