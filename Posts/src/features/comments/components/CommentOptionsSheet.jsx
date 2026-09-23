import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";

const REPORT_REASONS = [
  "Spam",
  "Harassment or bullying",
  "Hate speech",
  "False information",
  "Something else",
];

function Row({ icon, label, destructive, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-5 py-3.5 active:bg-black/[0.04]"
      accessibilityRole="button"
    >
      <Feather
        name={icon}
        size={19}
        color={destructive ? "#E0453C" : COLORS.textPrimary}
        className="mr-3.5"
      />
      <Text
        className={`font-poppins-medium text-[14.5px] ${destructive ? "text-[#E0453C]" : "text-textPrimary"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Bottom sheet triggered by a comment's "�" menu. Shows edit/delete for
 *  the comment's own author, or a report-reason picker for others'
 *  comments; Share is always available. `comment` is null when closed. */
export default function CommentOptionsSheet({
  comment,
  isOwnComment,
  onClose,
  onEdit,
  onDelete,
  onShare,
  onSubmitReport,
}) {
  const [mode, setMode] = useState("actions");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (comment) setMode("actions");
  }, [comment]);

  return (
    <Modal visible={!!comment} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/[0.35]" onPress={onClose} />
      <View
        className="absolute left-0 right-0 bottom-0 overflow-hidden rounded-t-[20px] bg-surfaceWhite"
        style={{
          // Runtime safe-area value — stays inline, same as ReportReasonSheet.
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        <View className="self-center w-9 h-1 rounded-sm mt-2.5 mb-1 bg-black/[0.12]" />

        {mode === "actions" ? (
          <>
            {isOwnComment ? (
              <>
                <Row icon="edit-2" label="Edit comment" onPress={onEdit} />
                <Row icon="trash-2" label="Delete comment" destructive onPress={onDelete} />
              </>
            ) : (
              <Row
                icon="flag"
                label="Report comment"
                destructive
                onPress={() => setMode("report")}
              />
            )}
            <Row icon="share" label="Share" onPress={onShare} />
          </>
        ) : (
          <>
            <Text className="font-poppins-sb text-[13px] text-textSecondary px-5 pt-1 pb-2">
              Why are you reporting this comment?
            </Text>
            {REPORT_REASONS.map((reason) => (
              <Row
                key={reason}
                icon="alert-circle"
                label={reason}
                onPress={() => onSubmitReport(reason)}
              />
            ))}
          </>
        )}
      </View>
    </Modal>
  );
}