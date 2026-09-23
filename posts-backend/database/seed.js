// Development-only seed script: creates demo users and posts so the app has
// data to render locally. Run with `npm run seed`. Never run in production —
// it wipes the users/posts/comments collections it seeds.

const bcrypt = require("bcryptjs");
const config = require("../config/env");
const logger = require("../config/logger");
const { connectDB, disconnectDB } = require("../config/database");

const User = require("../features/users/user.model");
const Post = require("../features/posts/post.model");
const Comment = require("../features/comments/comment.model");

async function seed() {
  if (config.isProduction) {
    logger.error("Refusing to run seed script in production");
    process.exit(1);
  }

  await connectDB();
  logger.info("Clearing existing demo data...");
  await Promise.all([User.deleteMany({}), Post.deleteMany({}), Comment.deleteMany({})]);

  const passwordHash = await bcrypt.hash("password123", 12);

  const [uday, riya, aisha] = await User.create([
    { name: "Uday Kumar", handle: "udaykumar", email: "uday@example.com", password: passwordHash, verified: true, location: "Jabalpur", isEmailVerified: true },
    { name: "Riya Shah", handle: "riyashah", email: "riya@example.com", password: passwordHash, isEmailVerified: true },
    { name: "Aisha Khan", handle: "aishakhan", email: "aisha@example.com", password: passwordHash, isEmailVerified: true },
  ]);

  const posts = await Post.create([
    {
      author: uday._id,
      description: "Ordered a set of hiking gear off the marketplace last week and wanted to write up how the packaging actually held up on a real trip.\n\nThe insulated bag survived a 6 hour drive and two days of freezing temps without a single leak.",
      images: [{ url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&fit=crop", fileId: "seed_1" }],
      location: "Jabalpur",
      verified: true,
      likeCount: 142,
    },
    {
      author: riya._id,
      description: "Spent the weekend refactoring the auth flow. Turns out the token refresh logic had a silent race condition that only showed up under slow network throttling.\n\nThe fix ended up being smaller than expected.",
      likeCount: 24,
    },
    {
      author: uday._id,
      description: "Walked out just before sunset and caught the light hitting the field perfectly. Worth every muddy boot.\n\nThe paddy was about three weeks from harvest.",
      images: [{ url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=600&fit=crop", fileId: "seed_2" }],
      location: "Jabalpur",
      verified: true,
      likeCount: 318,
    },
  ]);

  await Comment.create([
    { post: posts[0]._id, author: riya._id, text: "Good to know, ordering this for a trip next month." },
    { post: posts[2]._id, author: riya._id, text: "This is absolutely stunning, the reflection is unreal." },
    { post: posts[2]._id, author: aisha._id, text: "Save this for the harvest post too!" },
  ]);

  await Post.updateOne({ _id: posts[0]._id }, { $inc: { commentCount: 1 } });
  await Post.updateOne({ _id: posts[2]._id }, { $inc: { commentCount: 2 } });
  await User.updateMany({ _id: { $in: [uday._id, riya._id] } }, { $inc: { postCount: 0 } });
  await User.updateOne({ _id: uday._id }, { $set: { postCount: 2 } });
  await User.updateOne({ _id: riya._id }, { $set: { postCount: 1 } });

  logger.info("Seed complete. Demo login: uday@example.com / password123");
  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  logger.error("Seed failed", err);
  process.exit(1);
});
