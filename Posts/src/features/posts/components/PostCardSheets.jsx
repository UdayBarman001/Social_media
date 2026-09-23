import { memo } from "react";
import PostActionSheet from "./PostActionSheet";
import CommentSheet from "../../comments/components/CommentSheet";
import CommentOptionsSheet from "../../comments/components/CommentOptionsSheet";
import ReportReasonSheet from "../../../shared/components/ReportReasonSheet";
import ConfirmationToast from "../../../shared/ui/ConfirmationToast";

/**
 * PostCardSheets: Handles lazy mounting of PostActionSheet, CommentSheet,
 * CommentOptionsSheet, ReportReasonSheet, and ConfirmationToast.
 */
const PostCardSheets = memo(function PostCardSheets({
  menuEverOpened,
  menuOpen,
  onCloseMenu,
  isAuthor,
  authorOptions,
  viewerOptions,
  commentsEverOpened,
  commentSheetOpen,
  onCloseComments,
  comments,
  commentsLoading,
  commentsData,
  commentsError,
  loadComments,
  handleCommentSubmit,
  handleLikeComment,
  handleOpenCommentMenu,
  editingCommentId,
  editText,
  setEditText,
  handleSaveEditComment,
  handleCancelEditComment,
  menuComment,
  userId,
  handleCloseCommentMenu,
  handleStartEditComment,
  handleDeleteComment,
  handleShareComment,
  handleSubmitCommentReport,
  reportSheetOpen,
  onCloseReportSheet,
  handleSubmitPostReport,
  confirmation,
  onCloseConfirmation,
}) {
  return (
    <>
      {menuEverOpened && (
        <PostActionSheet
          visible={menuOpen}
          onClose={onCloseMenu}
          options={isAuthor ? authorOptions : viewerOptions}
        />
      )}

      {commentsEverOpened && (
        <CommentSheet
          visible={commentSheetOpen}
          onClose={onCloseComments}
          comments={comments}
          loading={commentsLoading || commentsData === undefined}
          error={commentsError}
          onRetryLoad={loadComments}
          onSubmit={handleCommentSubmit}
          onLikeComment={handleLikeComment}
          onOpenMenu={handleOpenCommentMenu}
          editingCommentId={editingCommentId}
          editText={editText}
          onChangeEditText={setEditText}
          onSaveEdit={handleSaveEditComment}
          onCancelEdit={handleCancelEditComment}
        />
      )}

      {commentsEverOpened && (
        <CommentOptionsSheet
          comment={menuComment}
          isOwnComment={!!menuComment && menuComment.author === userId}
          onClose={handleCloseCommentMenu}
          onEdit={handleStartEditComment}
          onDelete={handleDeleteComment}
          onShare={handleShareComment}
          onSubmitReport={handleSubmitCommentReport}
        />
      )}

      <ReportReasonSheet
        visible={reportSheetOpen}
        label="post"
        onClose={onCloseReportSheet}
        onSubmitReport={handleSubmitPostReport}
      />

      <ConfirmationToast
        visible={!!confirmation}
        title={confirmation?.title}
        message={confirmation?.message}
        onClose={onCloseConfirmation}
      />
    </>
  );
});

export default PostCardSheets;
