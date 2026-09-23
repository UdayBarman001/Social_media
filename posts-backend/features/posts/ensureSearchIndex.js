// Idempotent "make sure the Atlas Search index exists, and matches the
// current definition" helper. Shared by scripts/create-posts-search-
// index.js (manual/CI run) and server.js (best-effort auto-run on boot)
// so both stay in sync with exactly one definition of the index instead
// of two copies that can drift.
//
// Deliberately never throws on the "not Atlas" case (createSearchIndex/
// listSearchIndexes/updateSearchIndex don't exist on a local/self-hosted
// `mongod`) — callers decide what a failure means for them: the manual
// script treats it as a real error (you're expected to be pointed at
// Atlas when running it on purpose), server.js treats it as "fine, the
// $regex fallback in post.repository.js#searchPosts covers this
// environment instead." That same fallback is also what keeps search
// working for live traffic during the ~1 min an update/create is
// rebuilding in the background below — nothing here can take search
// offline, on Atlas or off it.

const INDEX_NAME = "posts_description_search";

async function ensureSearchIndex(mongoose, logger) {
  const posts = mongoose.connection.db.collection("posts");

  // `tags` is indexed alongside `description` because post.repository.js#
  // searchPostsAtlas runs a compound.should across both paths (a query
  // should match a post's caption OR one of its tags).
  //
  // `tags` MUST be mapped as type "autocomplete", not plain "string" —
  // this is what actually fixes "agri" not matching a post tagged
  // "agriculture". Atlas's `text` operator (used for a plain "string"
  // field) only matches whole tokens ± a typo edit-distance; it has no
  // concept of prefix matching, so no `fuzzy` tuning could ever make
  // "agri" match the token "agriculture". "autocomplete" is Atlas's
  // dedicated prefix/typeahead field type — indexing it here is required
  // before post.repository.js#searchPostsAtlas's `autocomplete` operator
  // (on the same path) can return anything. `tokenization: "edgeGram"`
  // (the default) builds prefixes from the START of each token, matching
  // the same left-anchored behavior as the {tags:1} regex fallback below,
  // so Atlas and non-Atlas deployments behave the same way for tags.
  const definition = {
    mappings: {
      dynamic: false,
      fields: {
        description: [{ type: "string" }],
        tags: [{ type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: false }],
      },
    },
  };

  const existing = await posts.listSearchIndexes().toArray();
  const current = existing.find((i) => i.name === INDEX_NAME);

  if (current) {
    // Checks the field is not just present but mapped as "autocomplete"
    // specifically — a deployment that already picked up the earlier
    // "tags: string" version of this index (prefix search silently
    // broken, per the comment above) needs to be upgraded again, not
    // skipped just because a `tags` field of SOME type already exists.
    const tagsFieldType = current.latestDefinition?.mappings?.fields?.tags?.[0]?.type;
    const isUpToDate = tagsFieldType === "autocomplete";
    if (isUpToDate) {
      logger.info(`Search index "${INDEX_NAME}" already up to date — skipping.`);
      return { created: false, alreadyExisted: true, updated: false };
    }

    // updateSearchIndex rebuilds the index in the background — the OLD
    // definition keeps serving live queries throughout, and Mongo swaps
    // to the new one only once the rebuild finishes. No query ever sees
    // a missing/partial index, and post.repository.js's regex fallback
    // covers the (very unlikely) gap even if it did. Safe to run under
    // real traffic, not just at deploy time.
    await posts.updateSearchIndex(INDEX_NAME, definition);
    logger.info(`Search index "${INDEX_NAME}" had an outdated "tags" mapping (missing, or not type "autocomplete") — requested an update. Old definition keeps serving until the rebuild finishes (~1 min); check Atlas UI > Search for status.`);
    return { created: false, alreadyExisted: true, updated: true };
  }

  await posts.createSearchIndex({ name: INDEX_NAME, definition });

  logger.info(`Requested creation of "${INDEX_NAME}". Can take up to ~1 min to build — check Atlas UI > Search before relying on it.`);
  return { created: true, alreadyExisted: false, updated: false };
}

module.exports = { ensureSearchIndex, INDEX_NAME };