import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Share, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useFeedInteractions } from "../../feed/context/FeedContext";
import {
  useIsLiked,
  useIsBookmarked,
  useIsFollowing,
} from "../../feed/context/interactionMembershipStore";
import { useUser } from "../../../shared/context/LocalUserContext";
import { API_URL } from "../../../shared/services/config";
import COLORS from "../../../shared/theme/colors";
import RichCaption from "./RichCaption";
import PostCardHeader from "./PostCardHeader";
import PostCardMedia from "./PostCardMedia";
import PostCardActions from "./PostCardActions";
import PostCardSheets from "./PostCardSheets";
import { usePostAnimations } from "../hooks/usePostAnimations";
import { usePostComments } from "../hooks/usePostComments";

const richCaptionStyle = {
  fontFamily: "Poppins_400Regular",
  fontSize: 14,
  lineHeight: 22,
  color: COLORS.textPrimary,
};

// Memoized to prevent sibling re-renders from triggering re-execution
const PostCard = memo(function PostCard({
  postId,
  avatarUri,
  authorId,
  name,
  isVerified = false,
  timeAgo,
  location,
  primaryImageUri,
  images,
  category = "Field notes",
  caption,
  likeCount,
  commentCount,
  isAuthor = false,
  isFirst = false,
  onMenuOpenChange,
}) {
  const router = useRouter();
  const {
    toggleLike,
    toggleBookmark,
    toggleFollow,
    hidePost,
    removePost,
    reportPost,
  } = useFeedInteractions();
  const { userId } = useUser();
  const isLiked = useIsLiked(postId);
  const isSaved = useIsBookmarked(postId);
  const isFollowing = useIsFollowing(authorId);

  // Local card UI state
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuEverOpened, setMenuEverOpened] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [optimisticLikeDelta, setOptimisticLikeDelta] = useState(0);
  const prevPostIdRef = useRef(postId);

  // Animation controller hook
  const {
    likeScaleAnim,
    commentScaleAnim,
    followScaleAnim,
    shareScaleAnim,
    bookmarkScaleAnim,
    menuScaleAnim,
    burstAnim,
    playLikePressIn,
    playLikeBounce,
    playCommentBounce,
    playShareBounce,
    playBookmarkBounce,
    playMenuBounce,
    playFollowPressIn,
    playFollowPressOut,
    handleImageTap: triggerImageTap,
  } = usePostAnimations();

  const notifySheets = useCallback(
    (menu, comment) => onMenuOpenChange?.(menu || comment),
    [onMenuOpenChange],
  );

  // Comment controller hook
  const comments = usePostComments({
    postId,
    onCommentBounce: playCommentBounce,
    onNotifySheets: notifySheets,
    menuOpen,
    onToast: setConfirmation,
  });

  // FlashList recycling: reset card-level UI state before native paint
  useLayoutEffect(() => {
    if (prevPostIdRef.current !== postId) {
      prevPostIdRef.current = postId;
      setExpanded(false);
      setMenuOpen(false);
      setMenuEverOpened(false);
      setReportSheetOpen(false);
      setConfirmation(null);
      setOptimisticLikeDelta(0);
    }
  }, [postId]);

  useEffect(() => {
    setOptimisticLikeDelta(0);
  }, [likeCount]);

  const handleFollow = useCallback(
    () => toggleFollow(authorId, userId),
    [toggleFollow, authorId, userId],
  );

  const handleLike = useCallback(
    () => toggleLike(postId, userId),
    [toggleLike, postId, userId],
  );

  const handleLikePress = useCallback(() => {
    playLikeBounce();
    setOptimisticLikeDelta((d) => (isLiked ? d - 1 : d + 1));
    handleLike();
  }, [playLikeBounce, isLiked, handleLike]);

  const handleProfilePress = useCallback(() => {
    if (authorId) router.push(`/profile/${authorId}`);
  }, [authorId, router]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${caption}\n\n${API_URL}/posts/${postId}`,
        url: `${API_URL}/posts/${postId}`,
      });
    } catch {
      // dismissed
    }
  }, [caption, postId]);

  const handleMenu = useCallback(() => {
    setMenuEverOpened(true);
    setMenuOpen(true);
    notifySheets(true, comments.commentSheetOpen);
  }, [notifySheets, comments.commentSheetOpen]);

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false);
    notifySheets(false, comments.commentSheetOpen);
  }, [notifySheets, comments.commentSheetOpen]);

  const handleBookmarkPress = useCallback(() => {
    toggleBookmark(postId, userId);
  }, [toggleBookmark, postId, userId]);

  const handleSubmitPostReport = useCallback(
    async (reason) => {
      setReportSheetOpen(false);
      try {
        await reportPost(postId, userId, reason);
        setConfirmation({
          title: "Thanks for letting us know",
          message: "We'll review this post.",
        });
      } catch {
        Alert.alert("Couldn't submit report", "Please try again.");
      }
    },
    [reportPost, postId, userId],
  );

  const handleOpenReport = useCallback(() => setReportSheetOpen(true), []);
  const handleCloseReportSheet = useCallback(() => setReportSheetOpen(false), []);
  const handleCloseConfirmation = useCallback(() => setConfirmation(null), []);

  const authorOptions = useMemo(
    () => [
      {
        label: "Edit",
        icon: "edit-2",
        onPress: () => router.push(`/post/${postId}/edit`),
      },
      {
        label: "Delete",
        icon: "trash-2",
        destructive: true,
        onPress: () =>
          Alert.alert("Delete post", "This can't be undone.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => removePost(postId, userId),
            },
          ]),
      },
      { label: "Share", icon: "share-2", onPress: handleShare },
      {
        label: "Copy Link",
        icon: "link",
        onPress: () => Share.share({ message: `${API_URL}/posts/${postId}` }),
      },
      { label: "Cancel", icon: "x", isCancel: true },
    ],
    [router, postId, removePost, userId, handleShare],
  );

  const viewerOptions = useMemo(
    () => [
      {
        label: "Report",
        icon: "flag",
        onPress: handleOpenReport,
      },
      { label: "Hide", icon: "eye-off", onPress: () => hidePost(postId) },
      { label: "Share", icon: "share-2", onPress: handleShare },
      {
        label: "Copy Link",
        icon: "link",
        onPress: () => Share.share({ message: `${API_URL}/posts/${postId}` }),
      },
      { label: "Cancel", icon: "x", isCancel: true },
    ],
    [handleOpenReport, hidePost, postId, handleShare],
  );

  // Root View intentionally omits key prop to preserve FlashList cell recycling
  return (
    <View
      className="mb-4 bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: COLORS.borderDefault }}
    >
      <PostCardHeader
        postId={postId}
        avatarUri={avatarUri}
        name={name}
        isVerified={isVerified}
        location={location}
        timeAgo={timeAgo}
        isAuthor={isAuthor}
        isFollowing={isFollowing}
        onProfilePress={handleProfilePress}
        onFollow={handleFollow}
        onMenu={handleMenu}
        followScaleAnim={followScaleAnim}
        menuScaleAnim={menuScaleAnim}
        onFollowPressIn={playFollowPressIn}
        onFollowPressOut={playFollowPressOut}
        onMenuPressIn={playMenuBounce}
      />

      <PostCardMedia
        postId={postId}
        images={images}
        primaryImageUri={primaryImageUri}
        burstAnim={burstAnim}
        isLiked={isLiked}
        onLike={handleLike}
        triggerImageTap={triggerImageTap}
      />

      {!!caption && (
        <View className="px-4 pb-3">
          <RichCaption
            text={caption}
            numberOfLines={expanded ? undefined : 3}
            onPress={() => setExpanded((p) => !p)}
            style={richCaptionStyle}
          />
          {caption.length > 140 && (
            <Pressable onPress={() => setExpanded((p) => !p)}>
              <Text
                className="text-[12.5px] font-poppins-bold mt-1"
                style={{ color: COLORS.accentGreen }}
              >
                {expanded ? "Show less" : "Show more"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <PostCardActions
        isLiked={isLiked}
        likeCount={Math.max(0, Number(likeCount ?? 0) + optimisticLikeDelta)}
        onLikePress={handleLikePress}
        onLikePressIn={playLikePressIn}
        commentCount={commentCount}
        onComment={comments.handleOpenComments}
        onShare={handleShare}
        onSharePressIn={playShareBounce}
        isSaved={isSaved}
        onBookmark={handleBookmarkPress}
        onBookmarkPressIn={playBookmarkBounce}
        likeScaleAnim={likeScaleAnim}
        commentScaleAnim={commentScaleAnim}
        shareScaleAnim={shareScaleAnim}
        bookmarkScaleAnim={bookmarkScaleAnim}
      />

      <PostCardSheets
        menuEverOpened={menuEverOpened}
        menuOpen={menuOpen}
        onCloseMenu={handleCloseMenu}
        isAuthor={isAuthor}
        authorOptions={authorOptions}
        viewerOptions={viewerOptions}
        commentsEverOpened={comments.commentsEverOpened}
        commentSheetOpen={comments.commentSheetOpen}
        onCloseComments={comments.handleCloseComments}
        comments={comments.localComments}
        commentsLoading={comments.commentsLoading}
        commentsData={comments.commentsData}
        commentsError={comments.commentsError}
        loadComments={comments.loadComments}
        handleCommentSubmit={comments.handleCommentSubmit}
        handleLikeComment={comments.handleLikeComment}
        handleOpenCommentMenu={comments.handleOpenCommentMenu}
        editingCommentId={comments.editingCommentId}
        editText={comments.editText}
        setEditText={comments.setEditText}
        handleSaveEditComment={comments.handleSaveEditComment}
        handleCancelEditComment={comments.handleCancelEditComment}
        menuComment={comments.menuComment}
        userId={comments.userId}
        handleCloseCommentMenu={comments.handleCloseCommentMenu}
        handleStartEditComment={comments.handleStartEditComment}
        handleDeleteComment={comments.handleDeleteComment}
        handleShareComment={comments.handleShareComment}
        handleSubmitCommentReport={comments.handleSubmitCommentReport}
        reportSheetOpen={reportSheetOpen}
        onCloseReportSheet={handleCloseReportSheet}
        handleSubmitPostReport={handleSubmitPostReport}
        confirmation={confirmation}
        onCloseConfirmation={handleCloseConfirmation}
      />
    </View>
  );
});

export default PostCard;