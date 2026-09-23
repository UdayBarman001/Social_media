import { Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import COLORS from "../../../shared/theme/colors";

/** Post caption with #hashtags and @mentions highlighted in accent green
 *  and tappable.
 *
 *  Tapping a hashtag opens its own filtered feed (see app/tag/[tag].jsx /
 *  TagFeedScreen) — matching Facebook, which keeps hashtags live and
 *  clickable inside the post text itself. There is no separate tag-pill
 *  row anywhere anymore (TagSheet / POST_TAGS presets were removed) — a
 *  hashtag typed in the caption is the only place a tag ever appears,
 *  shown here and nowhere else.
 */
/**
 * Post caption with #hashtags and @mentions highlighted in accent green.
 * #hashtags navigate to /tag/[tag]. @mentions stay highlighted.
 * If onPress is provided, wraps text in Pressable (e.g. for expanding caption).
 */
export default function RichCaption({ text, style, numberOfLines, onPress }) {
  const router = useRouter();
  const parts = (text || "").split(/(\s+)/);

  const textNode = (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        const isHashtag = /^#[\p{L}\p{N}\p{M}_]+/u.test(part);
        const isMention = /^@[\p{L}\p{N}\p{M}_]+/u.test(part);
        return (
          <Text
            key={`${part}-${i}`}
            style={
              isHashtag || isMention
                ? { color: COLORS.accentGreen, fontWeight: "600" }
                : undefined
            }
            onPress={
              isHashtag
                ? () => router.push(`/tag/${encodeURIComponent(part.slice(1))}`)
                : undefined
            }
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );

  return onPress ? <Pressable onPress={onPress}>{textNode}</Pressable> : textNode;
}
