import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nestComments } from "../nestComments.js";

describe("nestComments", () => {
  it("returns an empty array when given null, undefined, or empty array", () => {
    assert.deepStrictEqual(nestComments([]), []);
    assert.deepStrictEqual(nestComments(null), []);
    assert.deepStrictEqual(nestComments(undefined), []);
  });

  it("correctly identifies Stage 1 root comments and sorts newest-first", () => {
    const flat = [
      { id: "c1", parentComment: null, text: "First root", createdAt: "2026-09-01T10:00:00Z" },
      { id: "c2", parentComment: null, text: "Second root", createdAt: "2026-09-01T11:00:00Z" },
    ];

    const tree = nestComments(flat);

    assert.strictEqual(tree.length, 2);
    assert.strictEqual(tree[0].id, "c2"); // Newer first
    assert.strictEqual(tree[0].stage, 1);
    assert.deepStrictEqual(tree[0].replies, []);
    assert.strictEqual(tree[1].id, "c1");
    assert.strictEqual(tree[1].stage, 1);
  });

  it("nests Stage 2 direct replies under their Stage 1 parent and sorts oldest-first", () => {
    const flat = [
      { id: "c1", parentComment: null, text: "Root comment", createdAt: "2026-09-01T10:00:00Z" },
      { id: "r2", parentComment: "c1", text: "Second reply", createdAt: "2026-09-01T10:05:00Z" },
      { id: "r1", parentComment: "c1", text: "First reply", createdAt: "2026-09-01T10:02:00Z" },
    ];

    const tree = nestComments(flat);

    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].id, "c1");
    assert.strictEqual(tree[0].replies.length, 2);
    // Chronological order for replies: r1 then r2
    assert.strictEqual(tree[0].replies[0].id, "r1");
    assert.strictEqual(tree[0].replies[0].stage, 2);
    assert.strictEqual(tree[0].replies[1].id, "r2");
    assert.strictEqual(tree[0].replies[1].stage, 2);
  });

  it("handles Stage 3 nested replies (Facebook-style 3-tier hierarchy)", () => {
    const flat = [
      { id: "c1", parentComment: null, author: "u1", authorName: "Alice", text: "Root", createdAt: "2026-09-01T10:00:00Z" },
      { id: "r1", parentComment: "c1", author: "u2", authorName: "Bob", text: "Stage 2 reply", createdAt: "2026-09-01T10:05:00Z" },
      { id: "r2", parentComment: "r1", author: "u3", authorName: "Charlie", text: "Stage 3 reply", createdAt: "2026-09-01T10:10:00Z" },
    ];

    const tree = nestComments(flat);

    assert.strictEqual(tree.length, 1);
    const root = tree[0];
    assert.strictEqual(root.replies.length, 1);
    const stage2 = root.replies[0];
    assert.strictEqual(stage2.stage, 2);
    assert.strictEqual(stage2.replies.length, 1);

    const stage3 = stage2.replies[0];
    assert.strictEqual(stage3.id, "r2");
    assert.strictEqual(stage3.stage, 3);
    assert.strictEqual(stage3.replyingToAuthor, "Bob");
  });

  it("safely rescues orphan replies whose parent is missing from the list", () => {
    const flat = [
      { id: "orphan1", parentComment: "nonexistent", text: "Orphan comment", createdAt: "2026-09-01T10:00:00Z" },
    ];

    const tree = nestComments(flat);

    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].id, "orphan1");
    assert.strictEqual(tree[0].stage, 1);
  });
});
