import { memo, useCallback, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import COLORS from "../../../shared/theme/colors";

const MAX_INPUT_HEIGHT = 108; // ~4.5 lines
const MIN_INPUT_HEIGHT = 40;
const STICKY_OFFSET = { closed: 0, opened: 0 };
const DUPLICATE_SEND_WINDOW_MS = 500;

/**
 * CommentComposer: Bottom input bar with KeyboardStickyView, auto-growing TextInput,
 * active reply-to pill banner, and spring-animated send button.
 */
export const CommentComposer = memo(function CommentComposer({
  inputRef,
  onSubmit,
  replyingTo,
  onCancelReply,
  commentsReady = true,
  reduceMotion = false,
  insets,
}) {
  const [text, setText] = useState("");
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const sendScale = useSharedValue(1);
  const lastSendTimeRef = useRef(0);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  const handleChangeText = useCallback((val) => {
    setText(val);
  }, []);

  const handleSend = useCallback(() => {
    const raw = text;
    const trimmedText = raw.trim();
    if (!trimmedText) return;
    const now = Date.now();
    if (now - lastSendTimeRef.current < DUPLICATE_SEND_WINDOW_MS) return;
    lastSendTimeRef.current = now;

    setText("");
    setInputHeight(MIN_INPUT_HEIGHT);
    const target = replyingTo;
    onCancelReply?.();
    onSubmit?.(trimmedText, target);
  }, [text, replyingTo, onSubmit, onCancelReply]);

  const composerFadeStyle = useAnimatedStyle(() => ({
    opacity: commentsReady ? 1 : 0.4,
  }));

  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  return (
    <KeyboardStickyView
      offset={STICKY_OFFSET}
      style={{ backgroundColor: COLORS.surfaceWhite }}
    >
      <Animated.View
        style={composerFadeStyle}
        pointerEvents={commentsReady ? "auto" : "none"}
      >
        {replyingTo && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(140)}
            exiting={reduceMotion ? undefined : FadeOut.duration(120)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: COLORS.surfaceGray,
            }}
          >
            <Text className="text-[12px] font-poppins text-textSecondary">
              Replying to{" "}
              <Text className="font-poppins-sb text-accentGreen">
                @{replyingTo.authorName || replyingTo.author}
              </Text>
            </Text>
            <Pressable
              onPress={onCancelReply}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
            >
              <Feather name="x" size={14} color={COLORS.placeholderText} />
            </Pressable>
          </Animated.View>
        )}

        <View
          className={`flex-row items-end px-[14px] pt-[10px] border-t-dividerLight bg-surfaceWhite ${
            replyingTo ? "border-t-0" : "border-t"
          }`}
          style={{
            paddingBottom: Math.max(insets?.bottom ?? 0, 10),
          }}
        >
          <View
            className={`flex-1 flex-row items-end mr-[10px] rounded-input px-[14px] bg-surfaceGray min-h-[40px] ${
              Platform.OS === "ios" ? "pt-[9px] pb-[9px]" : "pt-[6px] pb-[6px]"
            }`}
          >
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={handleChangeText}
              placeholder={
                replyingTo
                  ? `Reply to ${replyingTo.authorName || replyingTo.author}…`
                  : "Add a comment…"
              }
              placeholderTextColor={COLORS.placeholderText}
              multiline
              maxLength={500}
              blurOnSubmit={false}
              className="flex-1 font-poppins text-[13.5px] leading-[18px] text-textPrimary max-h-[108px] p-0"
              style={{
                height: Math.min(
                  Math.max(inputHeight, MIN_INPUT_HEIGHT - 16),
                  MAX_INPUT_HEIGHT
                ),
                textAlignVertical: "center",
              }}
              onContentSizeChange={(e) =>
                setInputHeight(e.nativeEvent.contentSize.height)
              }
              accessibilityLabel="Comment input"
              accessibilityHint={
                replyingTo
                  ? `Replying to ${replyingTo.authorName || replyingTo.author}`
                  : undefined
              }
            />
          </View>

          <Pressable
            focusable={false}
            onPressIn={() => {
              if (!canSend) return;
              inputRef?.current?.focus();
              sendScale.value = withSpring(
                0.88,
                { damping: 12, stiffness: 300 },
                () => {
                  sendScale.value = withSpring(1, {
                    damping: 12,
                    stiffness: 300,
                  });
                }
              );
              handleSend();
            }}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
            accessibilityState={{ disabled: !canSend }}
            className="w-[40px] h-[40px] rounded-[20px] items-center justify-center"
          >
            <Animated.View
              style={[
                sendStyle,
                {
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: canSend
                    ? COLORS.accentGreen
                    : COLORS.surfaceGrayAlt,
                },
              ]}
            >
              <Feather
                name="send"
                size={17}
                color={canSend ? "#fff" : COLORS.placeholderText}
              />
            </Animated.View>
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardStickyView>
  );
});

export default CommentComposer;
