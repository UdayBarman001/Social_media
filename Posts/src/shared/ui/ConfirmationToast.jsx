import { useEffect, useId, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import COLORS from "../theme/colors";
import { useSheetPortal } from "../components/SheetHost";

// ─────────────────────────────────────────────────────────────────────────
// Replaces Alert.alert(...) for the "report submitted" confirmations.
// Alert.alert renders the bare OS dialog (grey box, square corners, no
// control over styling) — this is a real in-tree component so it can
// carry the app's own rounded-card look, matching PostActionSheet /
// CommentSheet's portal pattern (see SheetHost.jsx: no RN <Modal>, so no
// separate native window / soft-input drift).
//
// Stays on screen until the user dismisses it (OK button or tapping the
// backdrop) — matching Facebook's own report-confirmation toast, rather
// than disappearing on a timer before it's been read.
// ─────────────────────────────────────────────────────────────────────────
export default function ConfirmationToast({ visible, onClose, title, message }) {
  const toastId = useId();
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
    // No auto-close timer — like Facebook's own report-confirmation toast,
    // this stays on screen until the user dismisses it (OK button or
    // tapping the backdrop below), instead of disappearing on its own.
  }, [visible]);

  const content = !visible ? null : (
    <View className="absolute inset-0 items-center justify-center px-[32px]">
      <Pressable onPress={onClose} className="absolute inset-0">
        <View
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(15,23,16,0.45)" }}
        />
      </Pressable>

      {/* Animated.View driven by shared scale/opacity values — stays
          inline for the transform/opacity, everything else is className. */}
      <Animated.View
        style={{ transform: [{ scale }], opacity, width: "100%", maxWidth: 340 }}
      >
        <View
          className="items-center rounded-[28px] bg-surfaceWhite px-[28px] pt-[28px] pb-[20px]"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <View
            className="items-center justify-center w-[56px] h-[56px] rounded-[28px] mb-[16px]"
            style={{ backgroundColor: COLORS.categoryBg }}
          >
            <Feather name="check" size={28} color={COLORS.accentGreen} />
          </View>

          <Text className="font-poppins-sb text-[17px] text-textPrimary text-center">
            {title}
          </Text>

          {!!message && (
            <Text className="font-poppins text-[13.5px] text-textSecondaryLight text-center mt-[6px] leading-[19px]">
              {message}
            </Text>
          )}

          <Pressable
            onPress={onClose}
            hitSlop={8}
            className="mt-[20px] w-full items-center justify-center h-[44px] rounded-[16px] bg-primary active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="OK"
          >
            <Text className="font-poppins-sb text-[14px] text-white">OK</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );

  useSheetPortal(toastId, visible && !!content, content);

  return null;
}
