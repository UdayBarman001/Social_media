/**
 * EditProfileSheet — bottom sheet for editing the current user's profile.
 * Portaled through SheetHost.jsx (not a native <Modal>) for the same
 * reason CommentSheet.jsx is: this sheet opens expo-image-picker's native
 * photo-picker Activity (handlePickAvatar), and on Android a <Modal> loses
 * proper window focus when a second native Activity opens on top of it
 * and doesn't reliably get it back when that Activity closes — leaving a
 * dimmed backdrop on screen with the sheet's own content gone or
 * unresponsive to touch. Rendering as an ordinary sibling in the app's
 * one root window sidesteps that two-window handoff entirely. Visually
 * still a transparent dim backdrop + rounded-top panel with a drag
 * handle, matching DisplayNamePrompt.jsx / MenuSheet.jsx.
 *
 * Drag-to-dismiss mirrors CommentSheet.jsx exactly (same hook — see
 * useDragToDismiss) but is only wired to the handle + header row (Cancel /
 * "Edit Profile" / Save), never the ScrollView of form fields below it —
 * same scoping CommentSheet uses to keep its FlatList's own scrolling
 * from fighting the sheet's drag gesture. The avatar picker and inputs
 * are untouched.
 *
 * Save is non-blocking: it fires both writes and closes the sheet in the
 * same tick, rather than awaiting the avatar upload + profile PATCH
 * round-trips first. Both mutations apply their change to local
 * state/every mounted query optimistically the instant they're fired —
 * see onMutate in useUpdateProfileMutation / useUpdateAvatarMutation —
 * so the person sees their edits immediately and never sits looking at a
 * spinner for however long ImageKit takes to process a new avatar. A
 * failure on the backend (e.g. handle taken) is rolled back and reported
 * asynchronously via each mutation's onError instead of being caught
 * here, since by then the sheet is already closed.
 *
 * Editable fields, mirroring what the backend actually accepts:
 *   - avatar (PATCH /users/me/avatar, multipart)
 *   - name, handle, bio, location (PATCH /users/me — validated and
 *     uniqueness-checked by the backend).
 */

import { useEffect, useId, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import COLORS from "../../../shared/theme/colors";
import { useUpdateProfileMutation } from "../../../shared/queries/useUpdateProfileMutation";
import { useUpdateAvatarMutation } from "../../../shared/queries/useUpdateAvatarMutation";
import { useDragToDismiss } from "../../../shared/hooks/useDragToDismiss";
import { useSheetPortal } from "../../../shared/components/SheetHost";
import { compressAvatar } from "../../../shared/utils/imageCompressor";

const BIO_MAX = 300;
const NAME_MAX = 80;
const HANDLE_MAX = 20;

export default function EditProfileSheet({ visible, onClose, userId, profileUser }) {
  const insets = useSafeAreaInsets();
  const sheetId = useId();
  const updateProfile = useUpdateProfileMutation();
  const updateAvatar = useUpdateAvatarMutation();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [localAvatarUri, setLocalAvatarUri] = useState(null); // picked, not yet saved
  const [contentHeight, setContentHeight] = useState(0);

  const saving = updateProfile.isPending || updateAvatar.isPending;

  const { mounted, panGesture, sheetStyle, backdropStyle, handleClose } = useDragToDismiss({
    visible,
    onClose,
    contentHeight,
    disabled: saving, // don't allow dismiss-by-drag while saving
    maxBackdropOpacity: 0.35, // matches this sheet's original rgba(0,0,0,0.35) backdrop
  });

  // Reset the form to the current server values every time the sheet opens
  // — otherwise a previous edit (or a stale close) would linger.
  useEffect(() => {
    if (visible) {
      setName(profileUser?.name ?? "");
      setHandle(profileUser?.handle ?? "");
      setBio(profileUser?.bio ?? "");
      setLocation(profileUser?.location ?? "");
      setLocalAvatarUri(null);
    }
  }, [visible, profileUser]);

  const normalizedHandle = handle.trim().toLowerCase();
  const handleValid = /^[a-z0-9_]{3,20}$/.test(normalizedHandle);
  const canSave = name.trim().length > 0 && handleValid && !saving;
  const avatarSource = localAvatarUri || profileUser?.avatarUrl || null;

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photo access needed", "Please allow photo library access to change your avatar.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        // Compress avatar to 500x500 (~50KB) to ensure instant upload
        const compressedAvatar = await compressAvatar(result.assets[0].uri);
        setLocalAvatarUri(compressedAvatar);
      }
    } catch (err) {
      console.error("AVATAR PICKER ERROR:", err);
      Alert.alert("Couldn't open photo picker", "Something went wrong. Please try again.");
    }
  };

  // Fires both writes and closes immediately — Save no longer means
  // "wait for the multipart avatar upload + ImageKit processing + a
  // second round-trip for the text fields, sequentially, before you get
  // your sheet back." Both mutations apply their change to local state
  // optimistically the instant they're fired (see onMutate in
  // useUpdateProfileMutation / useUpdateAvatarMutation) and the actual
  // network requests — including the slow part, the avatar upload — run
  // in the background after this function has already returned. If
  // either genuinely fails server-side (e.g. handle taken), that's
  // reported and rolled back asynchronously via each mutation's onError,
  // same as any other background sync failure — not by holding the
  // sheet open waiting to find out.
  const handleSave = () => {
    if (!canSave || !userId) return;

    const trimmedName = name.trim().slice(0, NAME_MAX);
    const trimmedHandle = normalizedHandle.slice(0, HANDLE_MAX);
    const trimmedBio = bio.trim().slice(0, BIO_MAX);
    const trimmedLocation = location.trim();

    // BUG FIX: this used to call updateProfile.mutate() unconditionally,
    // even when the person only picked a new avatar and touched nothing
    // else. That mutation's onMutate merges its (unchanged) fields into
    // the optimistic user — see useUpdateProfileMutation.js's onMutate for
    // the full race this caused with updateAvatar's own optimistic
    // update, which is what made an avatar-only save visibly revert to
    // the old photo before snapping to the new one. The deeper race is
    // now fixed at the source (both mutations merge onto live state, not
    // a stale snapshot), but skipping this call entirely when nothing
    // text-related changed removes the race outright for the single most
    // common edit, and avoids a pointless network PATCH with an unchanged
    // payload.
    const fieldsChanged =
      trimmedName !== (profileUser?.name ?? "") ||
      trimmedHandle !== (profileUser?.handle ?? "") ||
      trimmedBio !== (profileUser?.bio ?? "") ||
      trimmedLocation !== (profileUser?.location ?? "");

    if (localAvatarUri) {
      updateAvatar.mutate({ userId, imageUri: localAvatarUri });
    }

    if (fieldsChanged) {
      updateProfile.mutate({
        userId,
        fields: {
          name: trimmedName,
          handle: trimmedHandle,
          bio: trimmedBio,
          location: trimmedLocation,
        },
      });
    }

    onClose?.();
  };

  // Portaled through SheetHost instead of a native <Modal> — see
  // SheetHost.jsx and CommentSheet.jsx, which hit this exact class of bug
  // first: opening expo-image-picker's native photo-picker Activity from
  // inside a <Modal> loses/never regains proper window focus on return on
  // Android, leaving the dimmed backdrop on screen with the sheet content
  // gone or unresponsive to touch. Rendering as an ordinary sibling in the
  // app's own root window (this component's only job now) sidesteps the
  // two-window handoff entirely, so the picker Activity returns to the
  // same window the sheet already lives in.
  const sheetContent = mounted ? (
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Backdrop tap-to-dismiss — no-op while saving, same as before */}
        <Pressable
          className="absolute top-0 left-0 right-0 bottom-0"
          onPress={() => !saving && handleClose()}
          accessibilityLabel="Close edit profile"
        >
          {/* backdropStyle is a Reanimated shared-value-driven style
              (animated opacity from useDragToDismiss) — it's recomputed on
              the UI thread every frame of the drag/close gesture, which is
              exactly the kind of runtime value a static NativeWind class
              string structurally can't express. Stays inline; only the
              static absolute-fill + color part moved to className. */}
          <Animated.View
            pointerEvents="none"
            // Animated.View is react-native-reanimated's component, not
            // React Native's own View — confirmed against the actual
            // react-native-css-interop@0.2.6 registry this project depends
            // on (checked its components.js directly): only View, Text,
            // Image, Pressable, ScrollView, and a short fixed list of
            // others are registered for className. Animated.View isn't in
            // that list (same root cause as the LinearGradient bug above),
            // so className here would silently do nothing — this backdrop
            // needs to stay inline, not just backdropStyle.
            style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000" }, backdropStyle]}
          />
        </Pressable>

        <Animated.View
          // Same reason as the backdrop above: Animated.View isn't in
          // react-native-css-interop's registered-component list, so
          // className is inert here too. rounded-t-[20px]/overflow-hidden
          // moved into style to actually take effect.
          style={[
            sheetStyle,
            { maxHeight: "88%", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
          ]}
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        >
          {/* shadow-* utilities don't reliably cross iOS/Android via
              NativeWind (Android needs `elevation`, which has no Tailwind
              class equivalent here), so this one stays inline — same
              tradeoff every other sheet in this codebase makes. */}
          <View
            className="bg-surfaceWhite"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 16,
              elevation: 16,
            }}
          >
            <GestureDetector gesture={panGesture}>
              <View>
                {/* Drag handle */}
                <View className="items-center pt-[10px] pb-[6px]">
                  <View className="w-[36px] h-[4px] rounded-[2px] bg-dividerLight" />
                </View>

                {/* Header row */}
                <View className="flex-row items-center justify-between px-[20px] pb-[12px]">
                  <Pressable onPress={() => !saving && handleClose()} hitSlop={8} disabled={saving}>
                    <Text className="text-[15px] font-poppins text-placeholderText">
                      Cancel
                    </Text>
                  </Pressable>
                  <Text className="text-[16px] font-poppins-bd text-textPrimary">
                    Edit Profile
                  </Text>
                  <Pressable onPress={handleSave} hitSlop={8} disabled={!canSave}>
                    {saving ? (
                      <ActivityIndicator size="small" color={COLORS.accentGreen} />
                    ) : (
                      <Text
                        className={`text-[15px] font-poppins-sb ${canSave ? "text-accentGreen" : "text-placeholderText"}`}
                      >
                        Save
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </GestureDetector>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 20,
                // insets.bottom is a runtime value from useSafeAreaInsets —
                // no static class can express it, has to stay inline.
                paddingBottom: Math.max(insets.bottom, 20),
              }}
            >
              {/* Avatar picker */}
              <View className="items-center mb-[20px]">
                <Pressable
                  onPress={handlePickAvatar}
                  accessibilityRole="button"
                  accessibilityLabel="Change avatar"
                  className="w-[88px] h-[88px]"
                >
                  <View className="w-full h-full rounded-full overflow-hidden items-center justify-center bg-accentGreen">
                    {avatarSource ? (
                      <Image source={{ uri: avatarSource }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <Text className="font-poppins-bd text-[30px] text-textWhite">
                        {name?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    )}
                  </View>
                  <View className="items-center justify-center absolute -bottom-[2px] -right-[2px] w-[30px] h-[30px] rounded-full bg-accentGreen border-2 border-surfaceWhite">
                    <Feather name="camera" size={14} color="#fff" />
                  </View>
                </Pressable>
                <Text className="font-poppins text-[12px] mt-[8px] text-placeholderText">
                  Tap to change photo
                </Text>
              </View>

              {/* Name */}
              <Text className="font-poppins-sb text-[12px] mb-[6px] text-textSecondary">
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={COLORS.placeholderText}
                maxLength={NAME_MAX}
                autoCapitalize="words"
                className="border-[1.5px] border-borderDefault rounded-md px-[14px] py-[12px] text-[15px] font-poppins text-textPrimary mb-[16px]"
              />

              {/* Username / handle */}
              <Text className="font-poppins-sb text-[12px] mb-[6px] text-textSecondary">
                Username
              </Text>
              <TextInput
                value={handle}
                onChangeText={(value) => setHandle(value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, HANDLE_MAX))}
                placeholder="username"
                placeholderTextColor={COLORS.placeholderText}
                maxLength={HANDLE_MAX}
                autoCapitalize="none"
                autoCorrect={false}
                className={`border-[1.5px] rounded-md px-[14px] py-[12px] text-[15px] font-poppins text-textPrimary mb-[16px] ${handleValid ? "border-borderDefault" : "border-error"}`}
              />

              {/* Bio */}
              <View className="flex-row items-center justify-between mb-[6px]">
                <Text className="font-poppins-sb text-[12px] text-textSecondary">
                  Bio
                </Text>
                <Text className="font-poppins text-[11px] text-placeholderText">
                  {bio.length}/{BIO_MAX}
                </Text>
              </View>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people a bit about yourself"
                placeholderTextColor={COLORS.placeholderText}
                maxLength={BIO_MAX}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="border-[1.5px] border-borderDefault rounded-md px-[14px] py-[12px] text-[14px] font-poppins text-textPrimary min-h-[84px] mb-[16px]"
              />

              {/* Location */}
              <Text className="font-poppins-sb text-[12px] mb-[6px] text-textSecondary">
                Location
              </Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="City, region"
                placeholderTextColor={COLORS.placeholderText}
                maxLength={100}
                className="border-[1.5px] border-borderDefault rounded-md px-[14px] py-[12px] text-[15px] font-poppins text-textPrimary mb-[4px]"
              />
            </ScrollView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
  ) : null;

  useSheetPortal(sheetId, mounted, sheetContent);

  return null;
}