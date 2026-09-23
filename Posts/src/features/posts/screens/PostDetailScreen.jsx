import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  RefreshControl,
  TextInput,
  Platform,
  Keyboard,
  AccessibilityInfo,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useFetchPostByIdQuery } from "../../../shared/queries/useFetchPostByIdQuery";
import { usePostComments } from "../hooks/usePostComments";
import { timeAgo, count } from "../../../shared/utils/format";
import COLORS from "../../../shared/theme/colors";
import { useFeedInteractions } from "../../feed/context/FeedContext";
import {
  useIsLiked,
  useIsBookmarked,
} from "../../feed/context/interactionMembershipStore";
import { useUser } from "../../../shared/context/LocalUserContext";
import { API_URL } from "../../../shared/services/config";
import ImageLightbox from "../../../shared/ui/ImageLightbox";
import Avatar from "../../../shared/ui/Avatar";
import FadeIn from "../../../shared/ui/FadeIn";
import SkeletonCard from "../../feed/components/SkeletonCard";
import RichCaption from "../components/RichCaption";
import PostCardActions from "../components/PostCardActions";
import MediaCarousel from "../components/MediaCarousel";
import { usePostAnimations } from "../hooks/usePostAnimations";
import CommentSkeleton from "../../comments/components/CommentSkeleton";
import ConfirmationToast from "../../../shared/ui/ConfirmationToast";
import { CommentRow } from "../../comments/components/CommentRow";
import CommentOptionsSheet from "../../comments/components/CommentOptionsSheet";
import { nestComments } from "../../comments/utils/nestComments";

const STICKY_OFFSET = { closed: 0, opened: 0 };

/* ------------------------------------------------------------------ */
function GradientHeader({ onBack, insets }) {
  return (
    <LinearGradient
      colors={COLORS.gradients?.headerGreen || ["#4CAF50", "#2E7D32"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="px-4 z-10"
      style={{
        paddingTop: insets.top,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
      }}
    >
      <View className="flex-row items-center justify-between h-14">
        <Pressable
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="items-center justify-center w-10 h-10 rounded-full "
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
        >
          <Feather name="arrow-left" size={20} color={COLORS.categoryText} />
        </Pressable>
        <Text className="text-[17px] font-poppins-bd tracking-tight" style={{ color: COLORS.textPrimary }}>Post</Text>
        <View className="w-10" />
      </View>
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ */
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    reactToComment,
    toggleLike,
    toggleBookmark,
  } = useFeedInteractions();
  const { userId, name: storedUserName, user: currentUser } = useUser();
  const isLiked = useIsLiked(id);
  const isSaved = useIsBookmarked(id);
  const [optimisticLikeDelta, setOptimisticLikeDelta] = useState(0);

  const {
    likeScaleAnim,
    commentScaleAnim,
    shareScaleAnim,
    bookmarkScaleAnim,
    playLikePressIn,
    playLikeBounce,
    playCommentBounce,
    playShareBounce,
    playBookmarkBounce,
  } = usePostAnimations();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [inputText, setInputText] = useState("");
  const [myReactions, setMyReactions] = useState(new Map());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  // Encapsulated comment subsystem (shared with PostCard)
  const comments = usePostComments({
    postId: id,
    enabled: true,
    onToast: setConfirmation,
    onCommentSubmitted: scrollToEnd,
  });

  // ── Reduced-motion preference ──────────────────────────────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(setReduceMotion)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  const {
    data: post,
    isLoading: loading,
    error: postQueryError,
    refetch: refetchPost,
  } = useFetchPostByIdQuery(id);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)
    );
    return () => show.remove();
  }, []);

  const handleDetailCommentSubmit = async (text, replyingTo) => {
    if (!text.trim()) return;
    setIsSubmittingComment(true);
    setInputText("");
    setReplyTarget(null);
    scrollToEnd();
    try {
      await comments.handleCommentSubmit(text, replyingTo);
      scrollToEnd();
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleReactToComment = useCallback(
    (commentId, type) => {
      const current = myReactions.get(commentId);
      const nextReaction = current === type ? "none" : type;

      setMyReactions((prev) => {
        const next = new Map(prev);
        if (nextReaction === "none") next.delete(commentId);
        else next.set(commentId, nextReaction);
        return next;
      });
      comments.setLocalComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          let { likeCount = 0, dislikeCount = 0 } = c;
          if (current === "like") likeCount = Math.max(0, likeCount - 1);
          if (current === "dislike") dislikeCount = Math.max(0, dislikeCount - 1);
          if (nextReaction === "like") likeCount += 1;
          if (nextReaction === "dislike") dislikeCount += 1;
          return { ...c, likeCount, dislikeCount };
        })
      );

      reactToComment(id, commentId, nextReaction, userId).catch(() => {
        setMyReactions((prev) => {
          const next = new Map(prev);
          if (current) next.set(commentId, current);
          else next.delete(commentId);
          return next;
        });
        comments.loadComments();
      });
    },
    [id, reactToComment, userId, myReactions, comments]
  );

  const handleReply = (comment) => {
    setReplyTarget(comment);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  // Build comment tree from encapsulated local comments
  const topLevelComments = useMemo(
    () => nestComments(comments.localComments),
    [comments.localComments]
  );

  const reactionFor = useCallback((c) => myReactions.get(c.id), [myReactions]);
  const likeCountFor = useCallback((c) => c.likeCount || 0, []);
  const dislikeCountFor = useCallback((c) => c.dislikeCount || 0, []);
  const handleReact = useCallback(
    (comment, type) => handleReactToComment(comment.id, type),
    [handleReactToComment]
  );

  const authorNames = useMemo(
    () =>
      comments.localComments
        .map((c) => ({ name: c.authorName || c.author, id: c.author }))
        .filter((a) => a.name),
    [comments.localComments]
  );

  const handleMentionPress = useCallback(
    (authorId) => {
      if (!authorId) return;
      router.push(`/profile/${authorId}`);
    },
    [router]
  );

  const handleLike = useCallback(
    () => toggleLike(id, userId),
    [toggleLike, id, userId],
  );

  const handleLikePress = useCallback(() => {
    playLikeBounce();
    setOptimisticLikeDelta((d) => (isLiked ? d - 1 : d + 1));
    handleLike();
  }, [playLikeBounce, isLiked, handleLike]);

  const handleBookmarkPress = useCallback(() => {
    playBookmarkBounce();
    toggleBookmark(id, userId);
  }, [playBookmarkBounce, toggleBookmark, id, userId]);

  const handleShare = useCallback(async () => {
    playShareBounce();
    try {
      await Share.share({
        message: `${post?.description || "Check out this post"}\n\n${API_URL}/posts/${id}`,
        url: `${API_URL}/posts/${id}`,
      });
    } catch {
      // dismissed
    }
  }, [playShareBounce, post?.description, id]);

  const handleCommentPress = useCallback(() => {
    playCommentBounce();
    inputRef.current?.focus();
    scrollToEnd();
  }, [playCommentBounce, scrollToEnd]);

  if (loading) {
    return (
      <View className="flex-1" style={{ backgroundColor: COLORS.background }}>
        <StatusBar style="light" />
        <GradientHeader onBack={back} insets={insets} />
        <View className="flex-1 px-4 pt-4">
          <SkeletonCard />
        </View>
      </View>
    );
  }

  if (postQueryError || !post) {
    return (
      <View className="flex-1" style={{ backgroundColor: COLORS.background }}>
        <StatusBar style="light" />
        <GradientHeader onBack={back} insets={insets} />
        <View className="flex-1 items-center justify-center px-10">
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 72, height: 72, backgroundColor: COLORS.surfaceGray }}
          >
            <Feather name="alert-circle" size={32} color={COLORS.error} />
          </View>
          <Text
            className="mt-5 text-center font-poppins-medium text-[15px] leading-[22px] text-textSecondaryLight"
          >
            {postQueryError?.message || "This post doesn't exist, or may have been removed."}
          </Text>
          <Pressable
            onPress={back}
            className="mt-6 px-6 py-2.5 rounded-full"
            style={{ backgroundColor: COLORS.accentGreen }}
          >
            <Text className="text-white text-[13px] font-poppins-semibold">Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const {
    image,
    images,
    description,
    author,
    authorName,
    authorAvatar,
    authorVerified,
    createdAt,
    likeCount,
    commentCount,
    location,
  } = post;

  const own = String(author) === String(userId);
  const name = own ? currentUser?.name || authorName || author : authorName || author;
  const avatar = own ? currentUser?.avatarUrl ?? authorAvatar : authorAvatar;
  const media = images?.length ? images : image ? [image] : [];
  const fullCaption = description || "";

  const captionIsLong = fullCaption.length > 140;
  const displayCaption = captionExpanded
    ? fullCaption
    : fullCaption.slice(0, 140) + (captionIsLong && !captionExpanded ? "…" : "");

  // No separate tag pills anymore — Facebook-style, same as PostCard.jsx:
  // a tag only ever exists as a clickable #hashtag inline in the caption
  // above (RichCaption), rendered via displayCaption/fullCaption.

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.background }}>
      <StatusBar style="light" />
      <GradientHeader onBack={back} insets={insets} />

      <View className="flex-1">
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refetchPost}
              tintColor={COLORS.accentGreen}
              colors={[COLORS.accentGreen]}
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* ─── Post Card ─── */}
          <FadeIn>
            <View
              className="mx-4 mt-3 overflow-hidden rounded-3xl border"
              style={{ backgroundColor: COLORS.surfaceWhite, borderColor: COLORS.borderDefault }}
            >
              <View className="flex-row items-center px-4 pt-4 pb-3">
                <Pressable
                  onPress={() =>
                    author && router.push({ pathname: "/profile/[id]", params: { id: author } })
                  }
                  className="flex-1 flex-row items-center"
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${name}'s profile`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Avatar uri={avatar} name={name} size={42} />
                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center">
                      <Text
                        numberOfLines={1}
                        className="font-poppins-semibold text-[15px] text-text-primary shrink"
                      >
                        {name}
                      </Text>
                      {authorVerified && (
                        <MaterialCommunityIcons
                          name="check-decagram"
                          size={15}
                          color={COLORS.accentGreen}
                          className="ml-1.5"
                        />
                      )}
                    </View>
                    <View className="flex-row items-center mt-0.5">
                      {location && (
                        <Feather name="map-pin" size={11} color={COLORS.placeholderText} />
                      )}
                      <Text
                        numberOfLines={1}
                        className="font-poppins-regular text-[11.5px] text-placeholder"
                        style={{ marginLeft: location ? 3 : 0 }}
                      >
                        {location ? `${location} · ` : ""}
                        {timeAgo(createdAt)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>

              {media.length > 0 && (
                <View className="px-4 pb-1">
                  <MediaCarousel
                    media={media}
                    onOpenLightbox={(i) => {
                      setLightboxIndex(i);
                      setLightboxOpen(true);
                    }}
                  />
                </View>
              )}

              {!!fullCaption && (
                <View className="px-4 pb-3">
                  <RichCaption
                    text={displayCaption}
                    style={{
                      fontFamily: "Poppins_400Regular",
                      fontSize: 14,
                      lineHeight: 22,
                      color: COLORS.textPrimary,
                    }}
                  />
                  {captionIsLong && (
                    <Pressable
                      onPress={() => setCaptionExpanded((p) => !p)}
                      hitSlop={6}
                      className="mt-1 self-start"
                    >
                      <Text
                        className="font-poppins-bold text-[12.5px]"
                        style={{ color: COLORS.accentGreen }}
                      >
                        {captionExpanded ? "Show less" : "Show more"}
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
                showComment={false}
                onComment={handleCommentPress}
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
            </View>
          </FadeIn>

          {/* ─── Comments Section ─── */}
          <FadeIn delay={120}>
            <View className="mx-4 mt-1">
              <View className="flex-row items-center mb-0.5 mt-2">
                <Text className="font-poppins-bold text-[17px] text-text-primary">Comments</Text>
                <View
                  className="items-center justify-center ml-2.5 px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: COLORS.surfaceGray }}
                >
                  <Text
                    className="font-poppins-semibold text-[11px]"
                    style={{ color: COLORS.textSecondary }}
                  >
                    {count(commentCount)}
                  </Text>
                </View>
              </View>

              {comments.commentsLoading && !comments.localComments.length && (
                <>
                  <CommentSkeleton />
                  <CommentSkeleton />
                  <CommentSkeleton />
                </>
              )}

              {comments.commentsError && !comments.localComments.length && (
                <View className="items-center justify-center py-10 gap-3">
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={36}
                    color={COLORS.placeholderText}
                  />
                  <Text
                    className="font-poppins-medium text-[13px] text-center text-textSecondaryLight"
                  >
                    {comments.commentsError || "Couldn't load comments."}
                  </Text>
                  <Pressable
                    onPress={comments.loadComments}
                    className="px-5 py-2 rounded-full"
                    style={{ backgroundColor: COLORS.surfaceGray }}
                  >
                    <Text
                      className="font-poppins-semibold text-[12.5px]"
                      style={{ color: COLORS.accentGreen }}
                    >
                      Try again
                    </Text>
                  </Pressable>
                </View>
              )}

              {!comments.commentsLoading && !comments.localComments.length && !comments.commentsError && (
                <View className="items-center justify-center py-12">
                  <MaterialCommunityIcons
                    name="message-text-outline"
                    size={44}
                    color={COLORS.placeholderText}
                  />
                  <Text
                    className="mt-3 text-center font-poppins-medium text-sm leading-5 text-textSecondaryLight"
                  >
                    No comments yet.{"\n"}Be the first to share your thoughts.
                  </Text>
                </View>
              )}

              {topLevelComments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  reactionFor={reactionFor}
                  likeCountFor={likeCountFor}
                  dislikeCountFor={dislikeCountFor}
                  onReact={handleReact}
                  onReply={handleReply}
                  onMentionPress={handleMentionPress}
                  onOpenMenu={comments.handleOpenCommentMenu}
                  authors={authorNames}
                  reduceMotion={reduceMotion}
                  editingCommentId={comments.editingCommentId}
                  editText={comments.editText}
                  onChangeEditText={comments.setEditText}
                  onSaveEdit={comments.handleSaveEditComment}
                  onCancelEdit={comments.handleCancelEditComment}
                />
              ))}

              <View className="h-5" />
            </View>
          </FadeIn>
        </ScrollView>

        {/* ─── Sticky Comment Input ─── */}
        <KeyboardStickyView
          offset={STICKY_OFFSET}
          className="border-t border-black/[0.06]"
          style={{ backgroundColor: COLORS.surfaceWhite }}
        >
          {replyTarget && (
            <View
              className="flex-row items-center justify-between px-4 border-b border-black/[0.04]"
              style={{ paddingVertical: 6, backgroundColor: COLORS.surfaceGray }}
            >
              <Text className="font-poppins-medium text-xs text-text-secondary">
                Replying to{" "}
                <Text style={{ color: COLORS.accentGreen }}>@{replyTarget.authorName}</Text>
              </Text>
              <Pressable onPress={() => setReplyTarget(null)} hitSlop={8}>
                <Feather name="x" size={14} color={COLORS.textSecondary} />
              </Pressable>
            </View>
          )}

          <View
            className="flex-row items-end px-3 pt-2.5 gap-2.5"
            style={{ paddingBottom: Math.max(insets.bottom, 10) }}
          >
            <View className="mb-1">
              <Avatar
                uri={currentUser?.avatarUrl}
                name={currentUser?.name || storedUserName}
                size={32}
              />
            </View>

            <View
              className="flex-1 flex-row items-end"
              style={{
                backgroundColor: COLORS.surfaceGray,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: Platform.OS === "ios" ? 8 : 6,
                minHeight: 40,
                maxHeight: 120,
              }}
            >
              <TextInput
                ref={inputRef}
                value={inputText}
                onChangeText={setInputText}
                placeholder={replyTarget ? "Write a reply…" : "Write a comment…"}
                placeholderTextColor={COLORS.placeholderText}
                className="flex-1 font-poppins-regular text-sm text-text-primary py-0.5"
                style={{ maxHeight: 100, lineHeight: 20 }}
                multiline
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  if (inputText.trim()) handleDetailCommentSubmit(inputText, replyTarget);
                }}
                onFocus={scrollToEnd}
              />
              <Pressable
                onPress={() => handleDetailCommentSubmit(inputText, replyTarget)}
                disabled={!inputText.trim() || isSubmittingComment}
                style={{
                  opacity: inputText.trim() && !isSubmittingComment ? 1 : 0.35,
                  marginLeft: 8,
                  padding: 4,
                  marginBottom: Platform.OS === "ios" ? 2 : 4,
                }}
              >
                <Feather name="send" size={20} color={COLORS.accentGreen} />
              </Pressable>
            </View>
          </View>
        </KeyboardStickyView>
      </View>

      <ImageLightbox
        visible={lightboxOpen}
        images={media}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      <CommentOptionsSheet
        comment={comments.menuComment}
        isOwnComment={!!comments.menuComment && comments.menuComment.author === userId}
        onClose={comments.handleCloseCommentMenu}
        onEdit={comments.handleStartEditComment}
        onDelete={comments.handleDeleteComment}
        onShare={comments.handleShareComment}
        onSubmitReport={comments.handleSubmitCommentReport}
      />

      <ConfirmationToast
        visible={!!confirmation}
        title={confirmation?.title}
        message={confirmation?.message}
        onClose={() => setConfirmation(null)}
      />
    </View>
  );
}