export const MAX_CHARS = 900;
export const MAX_IMAGES = 6;
// Must match the backend's `body("tags").optional().isArray({ max: 10 })`
// (post.validation.js, both createPostValidation and updatePostValidation).
// Tags now come only from #hashtags typed in the caption (tagsFromCaption
// in hashtags.js), which enforces this cap client-side before submit —
// without it, a caption with 11+ hashtags would silently fail server-side
// with a generic 400 and no indication it was a tag-count problem.
export const MAX_TAGS = 10;