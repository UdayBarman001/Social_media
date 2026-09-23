import { useSyncExternalStore } from "react";

// PostCard used to read likedIds/bookmarkedIds/followingIds straight out of
// FeedInteractionContext and call `.has(postId)` on them. That works, but a
// React Context re-renders *every* consumer whenever the value it was given
// changes reference — so liking a single post created a new `likedIds` Set,
// which changed the context value, which re-rendered every mounted
// PostCard in the list (not just the one that was liked). On a feed with a
// few hundred rows that's exactly the "VirtualizedList is slow to update"
// symptom: one tap fans out into hundreds of component re-renders.
//
// This tiny external store sidesteps Context propagation for just those
// three membership checks. Each PostCard subscribes via useSyncExternalStore
// with a selector that returns a single boolean for *its own* id/authorId.
// The store still notifies on every change, but useSyncExternalStore only
// re-renders a given subscriber if the boolean its own selector returns has
// actually changed — so liking post A no longer touches the mounted
// component for post B.
//
// Deliberately kept in its own file with no imports beyond "react": this
// used to live inside FeedContext.jsx, which pulls in a large graph of
// query/mutation hooks. Keeping it isolated avoids any risk of these
// exports being requested before that larger module has finished
// initializing.
const interactionListeners = new Set();
const interactionRefs = {
  liked: new Set(),
  bookmarked: new Set(),
  following: new Set(),
};

function notifyInteractionListeners() {
  interactionListeners.forEach((listener) => listener());
}

function subscribeInteractions(listener) {
  interactionListeners.add(listener);
  return () => interactionListeners.delete(listener);
}

// Called by FeedProvider whenever likedIds/bookmarkedIds/followingIds
// change, to mirror the latest Sets into this store and notify subscribers.
export function setInteractionMembership({ liked, bookmarked, following }) {
  interactionRefs.liked = liked;
  interactionRefs.bookmarked = bookmarked;
  interactionRefs.following = following;
  notifyInteractionListeners();
}

export function setLikedImmediate(postId, isLiked) {
  const next = new Set(interactionRefs.liked);
  if (isLiked) next.add(postId);
  else next.delete(postId);
  interactionRefs.liked = next;
  notifyInteractionListeners();
}

export function setBookmarkedImmediate(postId, isBookmarked) {
  const next = new Set(interactionRefs.bookmarked);
  if (isBookmarked) next.add(postId);
  else next.delete(postId);
  interactionRefs.bookmarked = next;
  notifyInteractionListeners();
}

export function setFollowingImmediate(userId, isFollowing) {
  const next = new Set(interactionRefs.following);
  if (isFollowing) next.add(userId);
  else next.delete(userId);
  interactionRefs.following = next;
  notifyInteractionListeners();
}

export function useIsLiked(postId) {
  return useSyncExternalStore(subscribeInteractions, () =>
    interactionRefs.liked.has(postId),
  );
}

export function useIsBookmarked(postId) {
  return useSyncExternalStore(subscribeInteractions, () =>
    interactionRefs.bookmarked.has(postId),
  );
}

export function useIsFollowing(userId) {
  return useSyncExternalStore(subscribeInteractions, () =>
    interactionRefs.following.has(userId),
  );
}