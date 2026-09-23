import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  setInteractionMembership,
  setLikedImmediate,
  setBookmarkedImmediate,
  setFollowingImmediate,
} from "./interactionMembershipStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import {
  fetchPostsPage,
  fetchBookmarkedIds,
  fetchFollowingIds,
  fetchLikedIds,
} from "../../../shared/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { useLikePostMutation } from "../../../shared/queries/useLikePostMutation";
import { useUnlikePostMutation } from "../../../shared/queries/useUnlikePostMutation";
import { useDeletePostMutation } from "../../../shared/queries/useDeletePostMutation";
import { useUpdatePostMutation } from "../../../shared/queries/useUpdatePostMutation";

// Fire-and-forget: warms expo-image's memory+disk cache for a freshly
// fetched page of posts *before* FlashList ever mounts a cell for them.
// This is what actually makes scrolling into a new post feel instant
// instead of merely showing a nicer placeholder while it loads — by the
// time drawDistance pre-renders that cell, the request has often already
// resolved. Only the first image per post (the one visible without
// swiping the carousel) is prefetched; later carousel images are fetched
// on-demand same as before, since prefetching every image on a post with
// up to 6 would multiply the number of concurrent requests for images
// most users will never swipe to. Never awaited/returned — a slow or
// failed prefetch must never delay setPosts/setLoading, since a cache
// miss just falls back to the exact same on-demand load path this
// already had.
function prefetchPageImages(fetchedPosts) {
  const uris = (fetchedPosts || [])
    .map((p) => p.image || p.images?.[0])
    .filter(Boolean);
  if (!uris.length) return;
  // Individual calls (not the array-argument form) so one bad/expired
  // URL in a page can't abort prefetching the rest of that page's images.
  uris.forEach((uri) => {
    Image.prefetch(uri, "memory-disk").catch(() => {
      // Non-fatal — see comment above.
    });
  });
}
import { useAddCommentMutation } from "../../../shared/queries/useAddCommentMutation";
import { useLikeCommentMutation } from "../../../shared/queries/useLikeCommentMutation";
import { useUpdateCommentMutation } from "../../../shared/queries/useUpdateCommentMutation";
import { useDeleteCommentMutation } from "../../../shared/queries/useDeleteCommentMutation";
import { useCreateReportMutation } from "../../../shared/queries/useCreateReportMutation";
import { useAddBookmarkMutation } from "../../../shared/queries/useAddBookmarkMutation";
import { useRemoveBookmarkMutation } from "../../../shared/queries/useRemoveBookmarkMutation";
import { useFollowUserMutation } from "../../../shared/queries/useFollowUserMutation";
import { useUnfollowUserMutation } from "../../../shared/queries/useUnfollowUserMutation";

// Split for the same reason FeedPaginationContext is split out below:
// `posts` (FeedDataContext) changes on every pagination fetch, like, edit,
// delete, and comment-count bump. PostCard never reads `posts` — it only
// reads likedIds/bookmarkedIds/followingIds and the interaction callbacks
// (FeedInteractionContext) — but a single React Context re-renders *every*
// consumer whenever its value reference changes, regardless of which
// fields that consumer actually destructures. With one combined context,
// every `setPosts` call (e.g. loadMore appending a page) forced every
// mounted PostCard to fully re-render at the same moment FlashList was
// laying out the newly-appended cells, which was the root cause of the
// pagination white-flash/scroll-jump/layout-thrash bug: dozens of cells
// re-rendering synchronously on the JS thread starved FlashList's commit
// and made it read inconsistent measured heights mid-layout. FeedScreen is
// the only consumer of FeedDataContext, so posts updates no longer touch
// PostCard at all.
const FeedDataContext = createContext(null);
const FeedInteractionContext = createContext(null);
// Raw likedIds/bookmarkedIds/followingIds/hiddenIds Sets, for the couple of
// single-instance screens (ProfileScreen, PostDetailScreen) that need direct
// membership access rather than a per-id selector. PostCard deliberately
// does NOT read from this context — see useIsLiked/useIsBookmarked/
// useIsFollowing above — because this value's reference changes on every
// single like/bookmark/follow, and Context re-renders all consumers on
// every reference change regardless of which fields they use.
const FeedMembershipContext = createContext(null);

// Separate from the above on purpose: `loadingMore`/`hasNextPage` change on
// every pagination fetch, and every PostCard in the list calls useFeed().
// If these lived in FeedInteractionContext's own memoized value, toggling
// loadingMore while scrolling would change that value's reference and
// force every mounted PostCard to re-render along with FeedScreen's footer
// spinner — on a long feed that's expensive enough (see the
// VirtualizedList "slow to update" warnings) that React never paints the
// loadingMore=true frame before the fetch resolves and flips it back to
// false, so the spinner never becomes visible. Keeping pagination state in
// its own context means only FeedScreen (the sole consumer of
// useFeedPagination) re-renders when it changes.
const FeedPaginationContext = createContext(null);

const LIKED_KEY = "feed:liked";
const HIDDEN_KEY = "feed:hidden";

// See interactionMembershipStore.js for useIsLiked/useIsBookmarked/
// useIsFollowing — the store itself lives there, isolated from this
// module's larger import graph. FeedProvider below just pushes updates
// into it via setInteractionMembership() whenever the Sets change.

// ─── Provider ────────────────────────────────────────────────────────────────

export function FeedProvider({ children }) {
  const queryClient = useQueryClient();

  // Instant 0ms startup: hydrate initial posts directly from restored TanStack cache
  const [posts, setPosts] = useState(() => {
    const cached = queryClient?.getQueryData(["feed", 1]);
    return cached?.posts || [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = queryClient?.getQueryData(["feed", 1]);
    return !cached?.posts?.length;
  });
  const [error, setError] = useState(null);
  // Infinite-scroll state: which feed page we're on, whether the backend
  // says there's another page (from meta.hasNextPage), and whether a
  // "load next page" request is currently in flight (separate from
  // `loading`, which is the initial/refresh load and swaps in the
  // skeleton screen — loadingMore instead drives a small footer spinner).
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Cursor for "load more", captured from the last post actually shown to
  // this client (see meta.nextCursor from the backend's cursor-anchored
  // feed query). Using a data-anchored cursor instead of an incrementing
  // page number means a post created by someone else mid-scroll can't
  // shift everyone else's pagination window and cause a skipped/duplicated
  // post — the classic offset-pagination drift bug.
  const [nextCursor, setNextCursor] = useState(null);
  const [likedIds, setLikedIds] = useState(new Set());
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [followingIds, setFollowingIds] = useState(new Set());

  // Refs holding latest membership Sets so toggleLike / toggleBookmark
  // callbacks remain referentially stable without depending on Set state.
  const likedIdsRef = useRef(likedIds);
  likedIdsRef.current = likedIds;
  const bookmarkedIdsRef = useRef(bookmarkedIds);
  bookmarkedIdsRef.current = bookmarkedIds;
  // Mirror the three membership Sets into the external store (see
  // interactionMembershipStore.js) every time they change. This runs after
  // commit, so it doesn't add render work — it just lets PostCard's
  // selector hooks pick up the new membership on their own terms.
  useEffect(() => {
    setInteractionMembership({
      liked: likedIds,
      bookmarked: bookmarkedIds,
      following: followingIds,
    });
  }, [likedIds, bookmarkedIds, followingIds]);
  const loadedRef = useRef(false);
  // Synchronous in-flight guard for loadMore, kept alongside (not instead
  // of) the loadingMore *state*. State updates are async/batched, so two
  // onEndReached calls firing in the same JS tick (easy on Android during
  // a fast fling, since FlashList can re-evaluate onEndReached before
  // React has committed the previous setLoadingMore(true)) would both
  // read the same stale `loadingMore === false` closure and both pass
  // the guard, firing two requests for the same cursor. A ref updates
  // immediately, so the second call in the same tick sees it flipped
  // already. loadingMore state is kept as-is for the footer spinner UI.
  const loadingMoreRef = useRef(false);
  const likeMutation = useLikePostMutation();
  const unlikeMutation = useUnlikePostMutation();
  const deleteMutation = useDeletePostMutation();
  const updateMutation = useUpdatePostMutation();
  const addCommentMutation = useAddCommentMutation();
  const likeCommentMutation = useLikeCommentMutation();
  const updateCommentMutation = useUpdateCommentMutation();
  const deleteCommentMutation = useDeleteCommentMutation();
  const createReportMutation = useCreateReportMutation();
  const addBookmarkMutation = useAddBookmarkMutation();
  const removeBookmarkMutation = useRemoveBookmarkMutation();
  const followMutation = useFollowUserMutation();
  const unfollowMutation = useUnfollowUserMutation();

  // ── Persist helpers ────────────────────────────────────────────────────────

  const saveLikedTimeoutRef = useRef(null);
  const saveLiked = useCallback((ids) => {
    if (saveLikedTimeoutRef.current) clearTimeout(saveLikedTimeoutRef.current);
    saveLikedTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...ids])).catch(() => {});
    }, 500);
  }, []);

  const saveHiddenTimeoutRef = useRef(null);
  const saveHidden = useCallback((ids) => {
    if (saveHiddenTimeoutRef.current) clearTimeout(saveHiddenTimeoutRef.current);
    saveHiddenTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids])).catch(() => {});
    }, 500);
  }, []);

  // ── Load persisted state + posts on mount ──────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const [likedRaw, hiddenRaw] = await Promise.all([
          AsyncStorage.getItem(LIKED_KEY),
          AsyncStorage.getItem(HIDDEN_KEY),
        ]);
        if (likedRaw) setLikedIds(new Set(JSON.parse(likedRaw)));
        if (hiddenRaw) setHiddenIds(new Set(JSON.parse(hiddenRaw)));

        // Offline-first: If query cache has already hydrated page-1 posts, show them immediately
        const cachedFeed = queryClient.getQueryData(["feed", 1]);
        if (cachedFeed?.posts?.length) {
          setPosts((prev) => (prev.length === 0 ? cachedFeed.posts : prev));
          setLoading(false);
          setHasNextPage(!!cachedFeed.meta?.hasNextPage);
          setNextCursor(cachedFeed.meta?.nextCursor ?? null);
        }
      } catch {
        // ignore storage errors
      }
      loadedRef.current = true;
    }
    init();
  }, [queryClient]);

  // Bookmarked/following/liked state loads separately, keyed to whichever
  // local user is currently set — called explicitly by FeedScreen once
  // userId is known (see loadUserState below), rather than on mount, since
  // userId isn't available yet at FeedProvider's own mount time.
  //
  // likedIds is also seeded from AsyncStorage on mount (see the init
  // effect above) for an instant first paint, but that local cache is
  // never itself synced from the backend — only ever written to by this
  // device's own like/unlike toggles. That's how it can drift from the
  // server: uninstall+reinstall, a second device, or a toggle that
  // succeeded server-side but whose AsyncStorage write got interrupted
  // (app killed) all leave a stale local Set with no way to self-correct.
  // fetchLikedIds (mirrors fetchBookmarkedIds/fetchFollowingIds — same
  // GET .../<userId>/liked ~ .../following shape) makes the server the
  // source of truth here too: every launch overwrites the local Set with
  // what the backend actually has, and persists that back to AsyncStorage
  // so the corrected value survives to the next launch instead of just
  // this session.
  const loadUserState = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const [bookmarked, following, liked] = await Promise.all([
        fetchBookmarkedIds(userId),
        fetchFollowingIds(userId),
        fetchLikedIds(userId),
      ]);
      setBookmarkedIds(new Set(bookmarked));
      setFollowingIds(new Set(following));
      const likedSet = new Set(liked);
      setLikedIds(likedSet);
      saveLiked(likedSet);
    } catch {
      // Non-fatal — bookmarks/follows/likes just won't show their saved
      // state this session if the fetch fails; toggling still works going
      // forward, and likedIds falls back to whatever AsyncStorage already
      // had from the init effect above.
    }
  }, [saveLiked]);

  // ── Fetch posts ────────────────────────────────────────────────────────────

  // Resets to page 1 and replaces the whole list — used on mount, pull-to-refresh,
  // and whenever the feed needs a clean reload (e.g. coming back into focus).
  const reload = useCallback(() => {
    // Stale-while-revalidate: Only display skeleton screen if there are no cached posts visible
    setPosts((current) => {
      if (!current || current.length === 0) {
        setLoading(true);
      }
      return current;
    });
    setError(null);
    return queryClient
      .fetchQuery({
        queryKey: ["feed", 1],
        queryFn: () => fetchPostsPage({ page: 1 }),
        staleTime: 0,
      })
      .then(({ posts: fetched, meta }) => {
        setPosts(fetched);
        setPage(1);
        setHasNextPage(!!meta?.hasNextPage);
        // The backend now issues a signed nextCursor on the page-1 response
        // too (see post.service.js#getFeed), specifically so the client
        // never has to fabricate its own cursor. Discarding it here used to
        // force loadMore() into building a raw, unsigned {createdAt, id}
        // cursor as a fallback — which decodeCursor's HMAC check rejects
        // outright, so the very first "load more" past page 1 always
        // failed and silently stopped pagination.
        setNextCursor(meta?.nextCursor ?? null);
        prefetchPageImages(fetched);
        return fetched;
      })
      .catch((err) => {
        setError(err.message || "Couldn't load posts");
        throw err;
      })
      .finally(() => {
        setLoading(false);
      });
  }, [queryClient]);

  // Fetches the next page and appends — called by FeedScreen's
  // onEndReached. Guards against firing again while a page is already in
  // flight, and stops once the backend says there's no next page.
  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || loadingMore || loading || !hasNextPage) return;

    // nextCursor is always populated by reload()/an earlier loadMore() from
    // the backend's signed meta.nextCursor (see post.service.js#getFeed) —
    // never hand-build a cursor here. A locally-built {createdAt, id} blob
    // is unsigned, and decodeCursor's HMAC check rejects it outright
    // ("Invalid cursor signature"), which used to make the very first
    // "load more" after a reload fail silently and stop pagination dead.
    // If we ever get here with no signed cursor, bail instead of
    // reintroducing that broken fallback.
    const cursor = nextCursor;

    if (!cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    queryClient
      .fetchQuery({ queryKey: ["feed", "cursor", cursor], queryFn: () => fetchPostsPage({ cursor }) })
      .then(({ posts: fetched, meta }) => {
        setPosts((prev) => {
          // Defensive de-dupe in case a post that arrived on an earlier
          // page also lands on this one (e.g. new posts shifted the feed
          // between requests) — id is the natural key here.
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of fetched) {
            if (!seen.has(p.id)) merged.push(p);
          }
          return merged;
        });
        setNextCursor(meta?.nextCursor ?? null);
        setHasNextPage(!!meta?.hasNextPage);
        prefetchPageImages(fetched);
      })
      .catch(() => {
        // Non-fatal — leave hasNextPage as-is so the user can retry by
        // scrolling again; no need to surface a full-screen error for a
        // failed "load more" the way we do for the initial load.
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [queryClient, nextCursor, hasNextPage, loadingMore, loading]);

  // ── Toggle like (optimistic + rollback) ───────────────────────────────────

  const toggleLike = useCallback(
    async (postId, userId) => {
      const currentLiked = likedIdsRef.current;
      const wasLiked = currentLiked.has(postId);
      const delta = wasLiked ? -1 : 1;

      // Synchronous immediate external store notification (0ms icon update)
      setLikedImmediate(postId, !wasLiked);

      const newLiked = new Set(currentLiked);
      if (wasLiked) newLiked.delete(postId);
      else newLiked.add(postId);
      setLikedIds(newLiked);
      saveLiked(newLiked);

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likeCount: Math.max(0, p.likeCount + delta) }
            : p,
        ),
      );

      try {
        const updated = await (wasLiked
          ? unlikeMutation.mutateAsync({ id: postId, userId })
          : likeMutation.mutateAsync({ id: postId, userId }));
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, likeCount: updated.likeCount } : p,
          ),
        );
      } catch {
        setLikedImmediate(postId, wasLiked);
        setLikedIds(currentLiked);
        saveLiked(currentLiked);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, likeCount: Math.max(0, p.likeCount - delta) }
              : p,
          ),
        );
      }
    },
    [saveLiked, likeMutation, unlikeMutation],
  );

  // ── Toggle bookmark (optimistic + rollback) ────────────────────────────────

  const toggleBookmark = useCallback(
    async (postId, userId) => {
      const currentSaved = bookmarkedIdsRef.current;
      const wasSaved = currentSaved.has(postId);

      // Synchronous immediate external store notification (0ms bookmark update)
      setBookmarkedImmediate(postId, !wasSaved);

      const newSaved = new Set(currentSaved);
      if (wasSaved) newSaved.delete(postId);
      else newSaved.add(postId);
      setBookmarkedIds(newSaved);

      try {
        await (wasSaved
          ? removeBookmarkMutation.mutateAsync({ postId, userId })
          : addBookmarkMutation.mutateAsync({ postId, userId }));
      } catch {
        setBookmarkedImmediate(postId, wasSaved);
        setBookmarkedIds(currentSaved);
      }
    },
    [addBookmarkMutation, removeBookmarkMutation],
  );

  // ── Toggle follow (optimistic + rollback) ──────────────────────────────────

  const toggleFollow = useCallback(
    async (targetUserId, userId) => {
      const wasFollowing = followingIds.has(targetUserId);

      // Synchronous immediate external store notification (0ms follow update)
      setFollowingImmediate(targetUserId, !wasFollowing);

      const newFollowing = new Set(followingIds);
      if (wasFollowing) newFollowing.delete(targetUserId);
      else newFollowing.add(targetUserId);
      setFollowingIds(newFollowing);

      try {
        await (wasFollowing
          ? unfollowMutation.mutateAsync({ targetUserId, userId })
          : followMutation.mutateAsync({ targetUserId, userId }));
      } catch {
        setFollowingImmediate(targetUserId, wasFollowing);
        setFollowingIds(followingIds);
      }
    },
    [followingIds, followMutation, unfollowMutation],
  );

  // ── Hide post (client-only) ────────────────────────────────────────────────

  const hidePost = useCallback(
    (postId) => {
      const newHidden = new Set(hiddenIds);
      newHidden.add(postId);
      setHiddenIds(newHidden);
      saveHidden(newHidden);
    },
    [hiddenIds, saveHidden],
  );

  // ── Delete post ────────────────────────────────────────────────────────────

  const removePost = useCallback(async (postId, userId) => {
    let snapshot;
    setPosts((prev) => {
      snapshot = prev;
      return prev.filter((p) => p.id !== postId);
    });
    try {
      await deleteMutation.mutateAsync({ id: postId, userId });
    } catch {
      setPosts(snapshot);
    }
  }, [deleteMutation]);

  // `imageState` is `{ keepUrls, newImageUris }` (or omitted for a
  // text-only edit) — passed straight through to useUpdatePostMutation /
  // api.js's updatePost, which is the shape that actually drives the
  // keep-these-existing-images-and-upload-these-new-ones flow.
  const editPost = useCallback(async (postId, fields, imageState, userId) => {
    let snapshot;
    setPosts((prev) => {
      snapshot = prev;
      return prev.map((p) => (p.id === postId ? { ...p, ...fields } : p));
    });
    try {
      const updated = await updateMutation.mutateAsync({ id: postId, fields, imageState, userId });
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch {
      setPosts(snapshot);
    }
  }, [updateMutation]);

  const submitComment = useCallback(async (postId, userId, text, parentComment) => {
    try {
      // addComment returns the new comment object. We don't need to replace
      // the whole post in state — doing so would wipe the post's comments
      // array (which the backend never embeds in the post document) and
      // clear the optimistic comment PostCard already added to localComments.
      // Just increment the denormalized counter so the comment badge stays
      // accurate without blowing away local state.
      await addCommentMutation.mutateAsync({ postId, userId, text, parentComment });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, commentCount: (p.commentCount ?? 0) + 1 }
            : p,
        ),
      );
    } catch {
      throw new Error("Comment failed");
    }
  }, [addCommentMutation]);

  // reaction: 'like' | 'dislike' | 'none'. Returns { post, comment } —
  // `comment` carries just this one comment's fresh { id, likeCount,
  // dislikeCount } so PostDetailScreen can patch that single comment
  // locally instead of waiting on the query invalidation's refetch to
  // land (the invalidation still happens, via useLikeCommentMutation's
  // onSuccess, as the source of truth — this is just for instant
  // feedback).
  const reactToCommentAction = useCallback(async (postId, commentId, reaction, userId) => {
    const { post, comment } = await likeCommentMutation.mutateAsync({
      postId,
      commentId,
      reaction,
      userId,
    });
    setPosts((prev) => prev.map((p) => (p.id === postId ? post : p)));
    return comment;
  }, [likeCommentMutation]);

  const editComment = useCallback(async (postId, commentId, userId, text) => {
    return updateCommentMutation.mutateAsync({ postId, commentId, userId, text });
  }, [updateCommentMutation]);

  const deleteCommentAction = useCallback(async (postId, commentId, userId) => {
    await deleteCommentMutation.mutateAsync({ postId, commentId, userId });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 1) - 1) }
          : p,
      ),
    );
  }, [deleteCommentMutation]);

  const reportComment = useCallback(async (commentId, userId, reason) => {
    await createReportMutation.mutateAsync({
      targetType: "Comment",
      targetId: commentId,
      userId,
      reason,
    });
  }, [createReportMutation]);

  // Mirrors reportComment above — same generic /reports endpoint, just
  // targetType: "Post" instead of "Comment" (see report.validation.js on
  // the backend, which accepts either).
  const reportPost = useCallback(async (postId, userId, reason) => {
    await createReportMutation.mutateAsync({
      targetType: "Post",
      targetId: postId,
      userId,
      reason,
    });
  }, [createReportMutation]);

  // ── Prepend new post (called after create) ───────────────────────────────

  const prependPost = useCallback((post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  // ── Update comment count (called when navigating back from comments) ───────

  const updateCommentCount = useCallback((postId, count) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentCount: count } : p)),
    );
  }, []);

  // ── Visible posts (filter hidden) ─────────────────────────────────────────

  const visiblePosts = useMemo(
    () => posts.filter((p) => !hiddenIds.has(p.id)),
    [posts, hiddenIds],
  );

  // Consumed by FeedScreen only. Changes on every pagination fetch, like
  // (likeCount patch), edit, delete, and comment-count bump — none of
  // which PostCard needs to know about directly (it gets its own post's
  // fields as props from FeedScreen's renderItem, and its own
  // liked/saved/following flags from FeedInteractionContext below).
  const dataValue = useMemo(
    () => ({
      posts: visiblePosts,
      loading,
      error,
      reload,
      loadMore,
      loadUserState,
      updateCommentCount,
      prependPost,
    }),
    [visiblePosts, loading, error, reload, loadMore, loadUserState, updateCommentCount, prependPost],
  );

  // Consumed by PostCard. Note this does NOT depend on `posts`/`visiblePosts`
  // — a pagination fetch must never change this reference, or every
  // mounted PostCard re-renders at the exact moment FlashList is laying
  // out newly-appended cells (see the comment above FeedDataContext).
  const interactionValue = useMemo(
    () => ({
      toggleLike,
      toggleBookmark,
      toggleFollow,
      hidePost,
      removePost,
      editPost,
      submitComment,
      reactToComment: reactToCommentAction,
      editComment,
      deleteComment: deleteCommentAction,
      reportComment,
      reportPost,
    }),
    [
      toggleLike,
      toggleBookmark,
      toggleFollow,
      hidePost,
      removePost,
      editPost,
      submitComment,
      reactToCommentAction,
      editComment,
      deleteCommentAction,
      reportComment,
      reportPost,
    ],
  );

  // Consumed by ProfileScreen/PostDetailScreen only — see the comment on
  // FeedMembershipContext above for why PostCard avoids this.
  const membershipValue = useMemo(
    () => ({ likedIds, hiddenIds, bookmarkedIds, followingIds }),
    [likedIds, hiddenIds, bookmarkedIds, followingIds],
  );

  // Kept out of the above — see the comment on FeedPaginationContext.
  const paginationValue = useMemo(
    () => ({ loadingMore, hasNextPage }),
    [loadingMore, hasNextPage],
  );

  return (
    <FeedDataContext.Provider value={dataValue}>
      <FeedInteractionContext.Provider value={interactionValue}>
        <FeedMembershipContext.Provider value={membershipValue}>
          <FeedPaginationContext.Provider value={paginationValue}>
            {children}
          </FeedPaginationContext.Provider>
        </FeedMembershipContext.Provider>
      </FeedInteractionContext.Provider>
    </FeedDataContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

// FeedScreen: posts list + loading/error + reload/loadMore. Deliberately
// does NOT include likedIds/bookmarkedIds/followingIds/actions — see
// useFeedInteractions below. Kept as `useFeed` since FeedScreen was
// already the only real consumer of that half.
export function useFeed() {
  const ctx = useContext(FeedDataContext);
  if (!ctx) throw new Error("useFeed must be used inside FeedProvider");
  return ctx;
}

// PostCard: the interaction callbacks only (like/bookmark/follow/etc). Use
// this instead of useFeed() in anything that lives inside a list cell, so
// pagination/reload never triggers a re-render here. For a single post's
// liked/saved/following flag, use useIsLiked/useIsBookmarked/useIsFollowing
// instead of reading Sets off context — see the comment above
// FeedMembershipContext for why.
export function useFeedInteractions() {
  const ctx = useContext(FeedInteractionContext);
  if (!ctx) throw new Error("useFeedInteractions must be used inside FeedProvider");
  return ctx;
}

// ProfileScreen/PostDetailScreen: direct access to the raw
// likedIds/bookmarkedIds/followingIds/hiddenIds Sets. Fine for these —
// they're single-instance screens, not hundreds of list cells, so
// re-rendering on every membership change is cheap here.
export function useFeedMembership() {
  const ctx = useContext(FeedMembershipContext);
  if (!ctx) throw new Error("useFeedMembership must be used inside FeedProvider");
  return ctx;
}

// Only FeedScreen (for the footer spinner / onEndReached guard) should use
// this — that's the whole point of splitting it out. See the comment on
// FeedPaginationContext above.
export function useFeedPagination() {
  const ctx = useContext(FeedPaginationContext);
  if (!ctx) throw new Error("useFeedPagination must be used inside FeedProvider");
  return ctx;
}