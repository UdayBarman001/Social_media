import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Alert, Keyboard, Share } from "react-native";
import { useListCommentsQuery } from "../../../shared/queries/useListCommentsQuery";
import { useFeedInteractions } from "../../feed/context/FeedContext";
import { useUser } from "../../../shared/context/LocalUserContext";

/**
 * usePostComments: Encapsulates comment query fetching, optimistic updates,
 * inline editing, deletion, reporting, and sheet visibility for PostCard.
 */
export function usePostComments({
  postId,
  enabled = false,
  onCommentBounce,
  onNotifySheets,
  menuOpen,
  onToast,
  onCommentSubmitted,
}) {
  const {
    submitComment,
    reactToComment,
    editComment,
    deleteComment,
    reportComment,
  } = useFeedInteractions();
  const { userId: storedUserId, name: storedUserName } = useUser();
  const userId = storedUserId;

  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [commentsEverOpened, setCommentsEverOpened] = useState(false);
  const [localComments, setLocalComments] = useState([]);
  const [menuComment, setMenuComment] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState("");
  const pendingCommentSubmitsRef = useRef(0);
  const prevPostIdRef = useRef(postId);

  // FlashList recycling: reset local comments state when slot receives a new post
  useLayoutEffect(() => {
    if (prevPostIdRef.current !== postId) {
      prevPostIdRef.current = postId;
      setCommentSheetOpen(false);
      setCommentsEverOpened(false);
      setMenuComment(null);
      setEditingCommentId(null);
      setEditText("");
      setLocalComments([]);
    }
  }, [postId]);

  // Query comments if enabled (e.g. PostDetailScreen) or when sheet is open (e.g. PostCard)
  const shouldFetch = enabled || commentSheetOpen;
  const {
    data: commentsData,
    isFetching: commentsLoading,
    error: commentsQueryError,
    refetch: refetchComments,
  } = useListCommentsQuery(shouldFetch && postId ? postId : null);

  const commentsError = commentsQueryError?.message ?? null;

  // Pre-paint sync to avoid empty-state flash on reopening cached post comments
  useLayoutEffect(() => {
    if (commentsData) {
      setLocalComments(commentsData);
    }
  }, [commentsData]);

  const loadComments = useCallback(async () => {
    await refetchComments();
  }, [refetchComments]);

  const handleOpenComments = useCallback(() => {
    onCommentBounce?.();
    setCommentSheetOpen(true);
    setCommentsEverOpened(true);
    onNotifySheets?.(menuOpen, true);
  }, [onCommentBounce, onNotifySheets, menuOpen]);

  const handleCloseComments = useCallback(() => {
    setCommentSheetOpen(false);
    onNotifySheets?.(menuOpen, false);
  }, [onNotifySheets, menuOpen]);

  const handleCommentSubmit = useCallback(
    async (text, replyingTo) => {
      let parentComment = null;
      if (replyingTo) {
        const isLocal = typeof replyingTo.id === "string" && replyingTo.id.startsWith("local-comment-");
        parentComment = isLocal
          ? (replyingTo.parentComment || replyingTo.threadRootId || null)
          : replyingTo.id;
      }

      const stage = replyingTo ? (replyingTo.stage === 1 ? 2 : 3) : 1;
      const optimistic = {
        id: `local-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author: userId,
        authorName: storedUserName || userId,
        text,
        parentComment,
        createdAt: new Date().toISOString(),
        stage,
        replyingToAuthor: replyingTo ? (replyingTo.authorName || replyingTo.author) : null,
        replyingToAuthorId: replyingTo ? replyingTo.author : null,
        likeCount: 0,
        dislikeCount: 0,
      };
      pendingCommentSubmitsRef.current += 1;
      setLocalComments((prev) => [...prev, optimistic]);
      onCommentSubmitted?.(optimistic);
      try {
        await submitComment(postId, userId, text, parentComment);
        if (pendingCommentSubmitsRef.current === 1) {
          await refetchComments();
        }
      } catch {
        setLocalComments((prev) => prev.filter((c) => c !== optimistic));
        Alert.alert("Couldn't post comment", "Please try again.");
      } finally {
        pendingCommentSubmitsRef.current -= 1;
      }
    },
    [userId, storedUserName, submitComment, postId, refetchComments, onCommentSubmitted],
  );

  const handleOpenCommentMenu = useCallback((comment) => {
    Keyboard.dismiss();
    setMenuComment(comment);
  }, []);

  const handleCloseCommentMenu = useCallback(() => {
    setMenuComment(null);
  }, []);

  const handleStartEditComment = useCallback(() => {
    if (!menuComment) return;
    setEditingCommentId(menuComment.id);
    setEditText(menuComment.text);
    setMenuComment(null);
  }, [menuComment]);

  const handleCancelEditComment = useCallback(() => {
    setEditingCommentId(null);
    setEditText("");
  }, []);

  const handleSaveEditComment = useCallback(
    async (commentId) => {
      const trimmed = editText.trim();
      if (!trimmed) return;
      const previous = localComments;
      setLocalComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, text: trimmed, editedAt: new Date().toISOString() }
            : c,
        ),
      );
      setEditingCommentId(null);
      setEditText("");
      try {
        await editComment(postId, commentId, userId, trimmed);
      } catch {
        setLocalComments(previous);
        Alert.alert("Couldn't save changes", "Please try again.");
      }
    },
    [editText, localComments, editComment, postId, userId],
  );

  const handleDeleteComment = useCallback(() => {
    if (!menuComment) return;
    const target = menuComment;
    setMenuComment(null);
    Alert.alert("Delete comment?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const previous = localComments;
          setLocalComments((prev) =>
            prev.filter(
              (c) => c.id !== target.id && c.parentComment !== target.id,
            ),
          );
          try {
            await deleteComment(postId, target.id, userId);
          } catch {
            setLocalComments(previous);
            Alert.alert("Couldn't delete comment", "Please try again.");
          }
        },
      },
    ]);
  }, [menuComment, deleteComment, postId, userId, localComments]);

  const handleShareComment = useCallback(() => {
    if (!menuComment) return;
    const target = menuComment;
    setMenuComment(null);
    Share.share({
      message: `${target.authorName}: "${target.text}"\n\nShared from KrishiVerse`,
    });
  }, [menuComment]);

  const handleSubmitCommentReport = useCallback(
    async (reason) => {
      if (!menuComment) return;
      const target = menuComment;
      setMenuComment(null);
      try {
        await reportComment(target.id, userId, reason);
        onToast?.({
          title: "Thanks for letting us know",
          message: "We'll review this comment.",
        });
      } catch {
        Alert.alert("Couldn't submit report", "Please try again.");
      }
    },
    [menuComment, reportComment, userId, onToast],
  );

  const handleLikeComment = useCallback(
    (commentId, reaction) => {
      reactToComment(postId, commentId, reaction, userId);
    },
    [reactToComment, postId, userId],
  );

  return {
    userId,
    commentSheetOpen,
    commentsEverOpened,
    localComments,
    setLocalComments,
    commentsLoading,
    commentsError,
    commentsData,
    menuComment,
    editingCommentId,
    editText,
    setEditText,
    loadComments,
    handleOpenComments,
    handleCloseComments,
    handleCommentSubmit,
    handleOpenCommentMenu,
    handleCloseCommentMenu,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveEditComment,
    handleDeleteComment,
    handleShareComment,
    handleSubmitCommentReport,
    handleLikeComment,
  };
}
