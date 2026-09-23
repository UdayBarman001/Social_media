import { Text } from "react-native";
import COLORS from "../../../shared/theme/colors";
import { matchLeadingMention } from "../utils/mention";

/** Renders a comment's text, hyperlinking an "@Name" mention at the start
 *  in accent green (same visual language as PostCard's RichCaption) — tap
 *  it and it navigates to that author's profile, Instagram-style.
 *
 *  Two ways a mention can be present:
 *  1. Structural (preferred) — `mention={{ id, name }}`, set by
 *     nestComments.js for a reply-to-a-reply (the flattened "3rd stage").
 *     The name is rendered as "@name" ahead of `text`, which itself never
 *     contains the mention — it's derived at render time, not stored, so
 *     it can't drift from who the reply actually targets.
 *  2. Legacy text-based — a leading "@Name " literally inside `text`,
 *     matched against `authors` (longest name first, so multi-word names
 *     like "Riya Shah" match whole). Kept for backward compatibility with
 *     any comment authored before the structural mention existed.
 *
 *  Either way, tapping the mention calls `onMentionPress(authorId)` — the
 *  id is what makes it a real hyperlink (a jump to a profile) rather than
 *  just colored text. If no id can be resolved (e.g. a legacy mention
 *  whose author no longer matches anyone in this thread), the mention
 *  still renders but isn't pressable. */
export function CommentText({ text, style, authors, mention, onMentionPress }) {
  if (mention?.name) {
    return (
      <Text style={style}>
        <Text
          onPress={mention.id ? () => onMentionPress?.(mention.id) : undefined}
          suppressHighlighting
          style={{ color: COLORS.black, fontFamily: "Poppins_600SemiBold" }}
        >
          @{mention.name}
        </Text>
        {" "}
        {text}
      </Text>
    );
  }

  const match = matchLeadingMention(text, authors);
  if (!match) return <Text style={style}>{text}</Text>;

  const authorId = match.authorId;
  return (
    <Text style={style}>
      <Text
        onPress={authorId ? () => onMentionPress?.(authorId) : undefined}
        suppressHighlighting
        style={{ color: COLORS.black, fontFamily: "Poppins_600SemiBold" }}
      >
        {match.mentionText}
      </Text>
      {match.rest}
    </Text>
  );
}

export function initialsOf(name) {
  return name ? name.trim()[0]?.toUpperCase() ?? "?" : "?";
}