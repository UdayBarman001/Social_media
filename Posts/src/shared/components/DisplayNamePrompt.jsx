/**
 * DisplayNamePrompt — first-launch Modal sheet.
 *
 * Matches MenuSheet.jsx exactly: transparent Modal, dim backdrop,
 * mt-auto bottom panel, rounded-t-[20px], same drag-handle style.
 *
 * `visible` is controlled by _layout: true when userId is null.
 * Not dismissible via backdrop — a name is required to use the app.
 * When setName() resolves, userId becomes truthy and visible flips false,
 * closing the Modal automatically. The feed loads in the background.
 */

import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import COLORS from "../theme/colors";
import { useUser } from "../context/LocalUserContext";

export default function DisplayNamePrompt({ visible }) {
  const { setName } = useUser();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const canConfirm = value.trim().length >= 2;

  const handleConfirm = async () => {
    if (!canConfirm || saving) return;
    setSaving(true);
    try {
      await setName(value.trim());
    } catch {
      // Backend unreachable — leave the sheet open so they can retry
      // instead of silently failing closed with no explanation.
      Alert.alert("Couldn't connect", "Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {}} // not dismissible
    >
      {/* Backdrop — same shade as MenuSheet (0.35 opacity) */}
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/[0.35]"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Panel — mt-auto + rounded-t-[20px], same as MenuSheet */}
        <View
          className="rounded-t-[20px] overflow-hidden bg-surfaceWhite"
          style={{
            // Runtime safe-area value — stays inline, same as elsewhere.
            paddingBottom: Math.max(insets.bottom, 16),
            // shadow-*/elevation split by platform — no single NativeWind
            // class covers both, same tradeoff as EditProfileSheet's panel.
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 16,
            elevation: 16,
          }}
        >
          {/* Drag handle — identical to MenuSheet */}
          <View className="items-center pt-[10px] pb-[6px]">
            <View className="w-[36px] h-[4px] rounded-[2px] bg-dividerLight" />
          </View>

          <View className="px-[24px] pt-[8px] pb-[8px]">
            {/* Icon */}
            <View className="self-center w-[52px] h-[52px] rounded-full bg-accentGreen items-center justify-center mb-[14px]">
              <Feather name="user" size={22} color="#fff" />
            </View>

            {/* Heading */}
            <Text className="text-[17px] font-poppins-bd text-textPrimary text-center mb-[4px]">
              What should we call you?
            </Text>
            <Text className="text-[13px] font-poppins text-placeholderText text-center mb-[20px] leading-[18px]">
              Your name appears on posts and comments.
            </Text>

            {/* Input */}
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Enter your name…"
              placeholderTextColor={COLORS.placeholderText}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              maxLength={50}
              className={`border-[1.5px] rounded-md px-[14px] py-[12px] text-[15px] font-poppins text-textPrimary bg-surfaceWhite mb-[12px] ${canConfirm ? "border-accentGreen" : "border-borderDefault"}`}
            />

            {/* Confirm — same full-width pill style as other primary buttons */}
            <Pressable
              onPress={handleConfirm}
              disabled={!canConfirm || saving}
              className={`rounded-pill py-[14px] items-center ${canConfirm ? "bg-accentGreen" : "bg-headerLight"}`}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`text-[14px] font-poppins-sb ${canConfirm ? "text-white" : "text-placeholderText"}`}>
                  Continue
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}