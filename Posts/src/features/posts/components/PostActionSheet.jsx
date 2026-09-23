import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  BackHandler,
} from "react-native";
import { useEffect, useId, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector } from "react-native-gesture-handler";
import ReanimatedView from "react-native-reanimated";
import COLORS from "../../../shared/theme/colors";
import { useSheetPortal } from "../../../shared/components/SheetHost";
import { useDragToDismiss } from "../../../shared/hooks/useDragToDismiss";

/**
 * PostCard's three-dot "handle" menu.
 *
 * BUG FOUND: this previously rendered inside React Native's <Modal>. On
 * Android, <Modal> opens a separate native Dialog window that sits outside
 * GestureHandlerRootView (mounted once at the true app root — see
 * app/_layout.jsx) — so any GestureDetector/Gesture.Pan inside that Modal
 * silently doesn't receive touches there, even though it renders and looks
 * fine. That's why the drag handle wasn't responding: the gesture was
 * wired correctly, but it was never getting the touch stream to begin
 * with. This is the exact problem SheetHost.jsx exists to avoid (see the
 * comment block at the top of that file) — CommentSheet has never used
 * <Modal> for this reason. Fix: portal through useSheetPortal, same as
 * CommentSheet, instead of <Modal>. Everything else — the drag-to-dismiss
 * hook wiring, the handle-only gesture scope, the row press springs — is
 * unchanged from the previous version.
 */
export default function PostActionSheet({ visible, onClose, options = [] }) {
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState(0);
  const sheetId = useId();

  const { mounted, panGesture, sheetStyle, backdropStyle, handleClose } = useDragToDismiss({
    visible,
    onClose,
    contentHeight,
    maxBackdropOpacity: 0.65, // matches this sheet's original 0.65 backdrop
  });

  // Android hardware back button — Modal's onRequestClose handled this
  // before; without Modal we wire it ourselves, same as CommentSheet does.
  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // One scale ref per option row for independent spring animation.
  // Using a fixed-length array (max 6 options) so hook rules aren't violated.
  const rowScales = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  const springIn = (anim) =>
    Animated.spring(anim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const springOut = (anim) =>
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  const handleSelect = (opt) => {
    onClose?.();
    opt.onPress?.();
  };

  const sheetContent = mounted ? (
    <View className="absolute inset-0 justify-end">
      <Pressable onPress={handleClose} className="absolute inset-0">
        {/* ReanimatedView.View is react-native-reanimated's Animated.View
            equivalent — per the critical rule, no Animated.* implementation
            (RN-core or Reanimated) is in react-native-css-interop's
            registered component list, so className would be a no-op here.
            backdropStyle also comes from the useDragToDismiss hook as a
            shared-value-driven animated style, so the whole style array
            (including the static backgroundColor) has to stay inline
            together. */}
        <ReanimatedView.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "#0F1710" },
            backdropStyle,
          ]}
        />
      </Pressable>

      {/* Same reasoning as the backdrop above — ReanimatedView.View isn't
          className-registered, and sheetStyle is a shared-value-driven
          animated style from useDragToDismiss, so it stays inline. */}
      <ReanimatedView.View
        style={sheetStyle}
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
      >
        <View
          className="rounded-t-[24px] pt-2 bg-surfaceWhite"
          style={{
            paddingBottom: insets.bottom + 8,
            // Shadow (iOS) + elevation (Android) pair — NativeWind's
            // shadow-* utilities don't reliably cover both in this setup,
            // so this stays inline as one unit per the task rules.
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          <GestureDetector gesture={panGesture}>
            <View
              // Generous hit-slop — the visible handle bar is only 4px
              // tall, which was also making it hard to grab even setting
              // Modal aside. hitSlop widens the actual touch target
              // without changing how the handle looks.
              hitSlop={{ top: 14, bottom: 14, left: 40, right: 40 }}
              className="w-[40px] h-[4px] rounded-[2px] bg-borderDefault self-center my-[8px]"
            />
          </GestureDetector>

          <View
            className="px-[16px] pt-[4px]"
            // maxHeight is a runtime device-height measurement
            // (Dimensions.get) — stays inline.
            style={{ maxHeight: Dimensions.get("window").height * 0.7 }}
          >
            {options.map((opt, i) => {
              const isDestructive = !!opt.destructive;
              const isCancel = opt.isCancel;
              return (
                <Pressable
                  key={opt.label + i}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  onPress={() =>
                    isCancel ? handleClose() : handleSelect(opt)
                  }
                  onPressIn={() => springIn(rowScales[i])}
                  onPressOut={() => springOut(rowScales[i])}
                  className={`flex-row items-center rounded-[16px] px-[16px] h-[52px] active:bg-surfaceGray ${
                    isCancel ? "mt-[4px] bg-headerLight" : "mt-[0px] bg-transparent"
                  }`}
                >
                  {/* RN-core Animated.View isn't className-registered, and
                      the transform is driven by rowScales[i] (an
                      Animated.Value) — whole style object stays inline. */}
                  <Animated.View
                    style={{ transform: [{ scale: rowScales[i] }], flexDirection: "row", alignItems: "center", flex: 1 }}
                  >
                    <View
                      className="items-center justify-center w-[34px] h-[34px] rounded-[17px] mr-[14px]"
                      // Two-branch backgroundColor: the destructive branch
                      // is a one-off translucent red tint with no reusable
                      // config token (not worth inventing a global token
                      // for a single use), and the other branch is a real
                      // token (surfaceGray) — keeping both branches of this
                      // one property together inline, rather than
                      // splitting them across className/style, avoids
                      // relying on style/className merge-order behavior
                      // that isn't proven elsewhere in this codebase.
                      style={{
                        backgroundColor: isDestructive
                          ? "rgba(239,68,68,0.1)"
                          : COLORS.surfaceGray,
                      }}
                    >
                      <Feather
                        name={opt.icon}
                        size={16}
                        color={
                          isDestructive ? COLORS.error : COLORS.iconLight
                        }
                      />
                    </View>
                    <Text
                      className={`font-poppins-sb text-[15px] shrink ${
                        isDestructive
                          ? "text-error"
                          : isCancel
                          ? "text-textSecondary"
                          : "text-textPrimary"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ReanimatedView.View>
    </View>
  ) : null;

  useSheetPortal(sheetId, mounted, sheetContent);

  return null;
}