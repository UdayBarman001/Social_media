import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import COLORS from "../theme/colors";

// Same reason set CommentOptionsSheet uses for comment reports — kept in
// sync so "report" means the same set of choices everywhere in the app,
// whether the target is a post or a comment.
const REPORT_REASONS = [
  "Spam",
  "Harassment or bullying",
  "Hate speech",
  "False information",
  "Something else",
];

function Row({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-5 py-3.5 active:bg-black/[0.04]"
      accessibilityRole="button"
    >
      <Feather name={icon} size={19} color={COLORS.textPrimary} className="mr-3.5" />
      <Text className="font-poppins-medium text-[14.5px] text-textPrimary">
        {label}
      </Text>
    </Pressable>
  );
}

/** Standalone reason-picker sheet — the same "why are you reporting this?"
 *  step CommentOptionsSheet shows inline as its "report" mode, pulled out
 *  so any reportable content (posts included) can trigger the exact same
 *  flow without duplicating comment-only edit/delete logic.
 *  `visible` controls whether the sheet is shown; `label` names what's
 *  being reported ("post", "comment", ...) in the header copy. */
export default function ReportReasonSheet({ visible, label = "post", onClose, onSubmitReport }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/[0.35]" onPress={onClose} />
      <View
        className="absolute left-0 right-0 bottom-0 overflow-hidden rounded-t-[20px] bg-surfaceWhite"
        style={{
          // Runtime safe-area value — no static class can express this,
          // has to stay inline (same as EditProfileSheet's ScrollView).
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        <View className="self-center w-9 h-1 rounded-sm mt-2.5 mb-1 bg-black/[0.12]" />

        {/* Pre-existing bug fixed here: "text-text-secondary" doesn't match
            any Tailwind class (the config token is "textSecondary", so the
            correct class is "text-textSecondary") — it was silently doing
            nothing and this text was falling back to the platform default
            color instead of COLORS.textSecondary. */}
        <Text className="font-poppins-sb text-[13px] text-textSecondary px-5 pt-1.2 pb-2">
          Why are you reporting this {label}?
        </Text>
        {REPORT_REASONS.map((reason) => (
          <Row key={reason} icon="alert-circle" label={reason} onPress={() => onSubmitReport(reason)} />
        ))}
      </View>
    </Modal>
  );
}