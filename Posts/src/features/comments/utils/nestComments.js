/**
 * Builds a 3-stage Facebook-style comment thread tree from a flat list of comments.
 *
 * Hierarchy:
 * - Stage 1 (Root comments): Top-level comments with parentComment = null.
 * - Stage 2 (Direct replies): Comments whose immediate parent is a Stage 1 comment.
 *   Contains its own nested `replies` array for Stage 3 replies.
 * - Stage 3 (Nested replies): Replies to Stage 2 replies or replies within Stage 3.
 *   Shows replyingToAuthor / replyingToAuthorId mention context, styled with
 *   Facebook-style nested connector lines.
 *
 * Sorting:
 * - Stage 1 is sorted newest-first (latest comments on top).
 * - Stage 2 and Stage 3 replies are sorted oldest-first (chronological conversation order).
 */
export function nestComments(flatComments) {
  if (!Array.isArray(flatComments) || flatComments.length === 0) return [];

  const byId = new Map(flatComments.map((c) => [String(c.id), c]));

  // Trace full ancestor chain from comment up to root
  function getAncestors(comment) {
    const chain = [];
    let current = comment;
    let guard = 0;
    while (current?.parentComment && byId.has(String(current.parentComment)) && guard < 30) {
      const parent = byId.get(String(current.parentComment));
      chain.push(parent);
      current = parent;
      guard++;
    }
    return chain; // [immediateParent, ..., root]
  }

  const topLevel = [];
  const topLevelMap = new Map();
  const stage2Map = new Map();

  // Pass 1: Stage 1 root comments
  flatComments.forEach((comment) => {
    if (!comment.parentComment) {
      const rootNode = {
        ...comment,
        stage: 1,
        replies: [],
        threadRootId: String(comment.id),
      };
      topLevel.push(rootNode);
      topLevelMap.set(String(comment.id), rootNode);
    }
  });

  // Pass 2: Map Stage 2 and Stage 3 replies
  flatComments.forEach((comment) => {
    if (!comment.parentComment) return;

    const immediateParent = byId.get(String(comment.parentComment));
    const chain = getAncestors(comment);
    const root = chain.length > 0 ? chain[chain.length - 1] : null;
    const rootEntry = root ? topLevelMap.get(String(root.id)) : null;

    // Orphan fallback
    if (!rootEntry) {
      const orphan = {
        ...comment,
        stage: 1,
        replies: [],
        threadRootId: String(comment.id),
      };
      topLevel.push(orphan);
      topLevelMap.set(String(comment.id), orphan);
      return;
    }

    if (chain.length === 1) {
      // Direct reply to root -> Stage 2
      let stage2Node = stage2Map.get(String(comment.id));
      if (!stage2Node) {
        stage2Node = {
          ...comment,
          stage: 2,
          replies: [],
          threadRootId: String(rootEntry.id),
          parentReplyId: String(comment.id),
          replyingToAuthor: immediateParent
            ? immediateParent.authorName || immediateParent.author
            : null,
          replyingToAuthorId: immediateParent ? immediateParent.author : null,
        };
        stage2Map.set(String(comment.id), stage2Node);
        rootEntry.replies.push(stage2Node);
      } else {
        Object.assign(stage2Node, {
          ...comment,
          stage: 2,
          threadRootId: String(rootEntry.id),
          parentReplyId: String(comment.id),
          replyingToAuthor: immediateParent
            ? immediateParent.authorName || immediateParent.author
            : null,
          replyingToAuthorId: immediateParent ? immediateParent.author : null,
        });
      }
    } else {
      // Reply to a reply -> Stage 3 (Facebook style nested reply)
      const stage2Ancestor = chain[chain.length - 2];
      let stage2Node = stage2Map.get(String(stage2Ancestor.id));
      if (!stage2Node) {
        stage2Node = {
          ...stage2Ancestor,
          stage: 2,
          replies: [],
          threadRootId: String(rootEntry.id),
          parentReplyId: String(stage2Ancestor.id),
          replyingToAuthor: rootEntry.authorName || rootEntry.author,
          replyingToAuthorId: rootEntry.author,
        };
        stage2Map.set(String(stage2Ancestor.id), stage2Node);
        rootEntry.replies.push(stage2Node);
      }

      const stage3Node = {
        ...comment,
        stage: 3,
        replies: [],
        threadRootId: String(rootEntry.id),
        parentReplyId: String(stage2Node.id),
        replyingToAuthor: immediateParent
          ? immediateParent.authorName || immediateParent.author
          : null,
        replyingToAuthorId: immediateParent ? immediateParent.author : null,
      };
      stage2Node.replies.push(stage3Node);
    }
  });

  // Sort Stage 1 newest-first
  topLevel.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Sort Stage 2 and Stage 3 oldest-first
  topLevel.forEach((t) => {
    t.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    t.replies.forEach((r) => {
      if (r.replies?.length > 0) {
        r.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }
    });
  });

  return topLevel;
}