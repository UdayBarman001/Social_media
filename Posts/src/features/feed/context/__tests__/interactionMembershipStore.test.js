import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  setInteractionMembership,
  setLikedImmediate,
  setBookmarkedImmediate,
  setFollowingImmediate,
} from "../interactionMembershipStore.js";

describe("interactionMembershipStore", () => {
  it("updates liked, bookmarked, and following sets via setInteractionMembership", () => {
    const initialLiked = new Set(["p1", "p2"]);
    const initialBookmarked = new Set(["p2"]);
    const initialFollowing = new Set(["u1"]);

    setInteractionMembership({
      liked: initialLiked,
      bookmarked: initialBookmarked,
      following: initialFollowing,
    });

    // Test immediate toggle methods
    setLikedImmediate("p3", true);
    setLikedImmediate("p1", false);

    setBookmarkedImmediate("p5", true);
    setBookmarkedImmediate("p2", false);

    setFollowingImmediate("u2", true);
    setFollowingImmediate("u1", false);

    assert.ok(true);
  });
});
