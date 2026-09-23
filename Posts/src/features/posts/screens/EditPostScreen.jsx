import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Alert,
  Keyboard,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState, useCallback, useRef } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import COLORS from "../../../shared/theme/colors";
import { useFeedInteractions } from "../../feed/context/FeedContext";
import { useUser } from "../../../shared/context/LocalUserContext";
import { useFetchPostByIdQuery } from "../../../shared/queries/useFetchPostByIdQuery";
import { useMediaPicker } from "../../../shared/hooks/useMediaPicker";
import MediaSourceSheet from "../../create-post/components/MediaSourceSheet";
import { MAX_IMAGES, MAX_TAGS } from "../../create-post/constants";
import { tagsFromCaption } from "../../../shared/utils/hashtags";

const ICON = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 22,
  header: 20,
};

const MAX_CHARS = 2000;

// Existing (already-uploaded) images come back from the backend as https
// URLs; anything picked on-device is a local file URI. Partitioning on
// this is how the mixed `images` array below gets split back into
// keepUrls/newImageUris at save time.
const isLocalFile = (uri) => /^(file|content|ph|assets-library):/.test(uri);

export default function EditPostScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { editPost } = useFeedInteractions();
  const { userId: storedUserId } = useUser();
  const userId = storedUserId;

  const [description, setDescription] = useState("");
  // Single mixed array — existing https:// URLs plus any newly-picked local
  // uris, in display order. Mirrors useCreatePost's `images` state so the
  // same add/remove/grid pattern works for both create and edit.
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const pressAnim = useRef(new Animated.Value(1)).current;
  const photoCardAnim = useRef(new Animated.Value(1)).current;

  const { data: post, isLoading: loading, isError } = useFetchPostByIdQuery(id);

  const [originalValues, setOriginalValues] = useState({
    description: "",
    images: [],
  });

  useEffect(() => {
    if (post) {
      const initial = {
        description: post.description || "",
        images: post.images ?? (post.image ? [post.image] : []),
      };
      setDescription(initial.description);
      setImages(initial.images);
      setOriginalValues(initial);
    }
  }, [post]);

  useEffect(() => {
    if (isError) {
      Alert.alert("Error", "Could not load post.");
    }
  }, [isError]);

  useEffect(() => {
    const imagesChanged =
      images.length !== originalValues.images.length ||
      images.some((uri, i) => uri !== originalValues.images[i]);
    // Tags are no longer independent state — they're derived from
    // `description` at save time (tagsFromCaption), so a tag edit is
    // always also a description edit and is already covered by the
    // description comparison below.
    const changed =
      description !== originalValues.description || imagesChanged;
    setHasChanges(changed);
  }, [description, images, originalValues]);

  const handleGoBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => (router.canGoBack() ? router.back() : router.replace("/")),
          },
        ]
      );
    } else {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
  }, [hasChanges, router]);

  const remainingSlots = Math.max(0, MAX_IMAGES - images.length);

  const addImages = useCallback((uris) => {
    setImages((prev) => {
      const merged = [...prev, ...uris];
      if (merged.length > MAX_IMAGES) {
        Alert.alert("Too many photos", `You can attach up to ${MAX_IMAGES} photos per post.`);
      }
      return merged.slice(0, MAX_IMAGES);
    });
  }, []);

  const removeImageAt = useCallback((index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = async () => {
    // A post is valid with a caption OR images (matches useCreatePost's
    // canPost and the backend's own createPost/updatePost validation) —
    // requiring description alone made it impossible to save an
    // image-only post's edits (new/removed images) or to intentionally
    // clear the caption on an image post.
    if (!description.trim() && images.length === 0) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      const keepUrls = images.filter((uri) => !isLocalFile(uri));
      const newImageUris = images.filter(isLocalFile);

      await editPost(
        id,
        {
          description: description.trim(),
          // Facebook-style, same as CreatePostScreen: tags come only from
          // #hashtags typed in the caption, re-derived fresh on every
          // save. Editing/removing a tag means editing the text itself.
          tags: tagsFromCaption(description, MAX_TAGS),
        },
        { keepUrls, newImageUris },
        userId
      );
      setHasChanges(false);
      router.back();
    } catch {
      Alert.alert("Error", "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  // Unified media picker hook (shared with CreatePostScreen)
  const mediaPicker = useMediaPicker({
    maxImages: MAX_IMAGES,
    remainingSlots,
    onAddImages: addImages,
    quality: 0.85,
  });

  const openMediaSheet = () => {
    if (saving) return;
    if (remainingSlots <= 0) {
      Alert.alert("Limit reached", `You can attach up to ${MAX_IMAGES} photos per post.`);
      return;
    }
    Keyboard.dismiss();
    mediaPicker.openMediaSheet();
  };

  // See the matching comment in handleSave above: description OR images
  // must be present, not description alone — otherwise the Save button
  // stays permanently disabled for any image-only post.
  const canSave =
    (description.trim().length > 0 || images.length > 0) &&
    !saving &&
    description.length <= MAX_CHARS;

  const headerHeight = insets.top + 56;

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <LinearGradient
          colors={COLORS.gradients.headerGreen}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top,
            height: headerHeight,
            paddingHorizontal: 16,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 5,
            zIndex: 10,
          }}
        >
          <View className="flex-row items-center justify-between h-[56px]">
            {/* 44px mirrors the old TOUCH.min constant (removed — no
                longer referenced now that it's a literal class). */}
            <View
              className="w-[44px] h-[44px] rounded-[22px]"
              // One-off translucent-white overlay (no reusable token) on
              // the header gradient — kept inline.
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            />
            <Text className="text-[17px] font-poppins-bd tracking-tight text-textPrimary">
              Edit Post
            </Text>
            {/* 44px mirrors the old TOUCH.min constant. */}
            <View className="w-[44px]" />
          </View>
        </LinearGradient>

        <SafeAreaView
          className="flex-1 bg-background"
          edges={["bottom", "left", "right"]}
        >
          <View className="px-[16px] pt-[16px]">
            <View className="p-[16px] bg-surfaceWhite rounded-[20px] border border-borderDefault gap-[12px]">
              <View
                className="rounded-[6px]"
                style={{ height: 20, width: "40%", backgroundColor: COLORS.skeleton }}
              />
              <View
                className="rounded-[12px]"
                style={{ height: 180, backgroundColor: COLORS.skeleton }}
              />
              <View
                className="rounded-[12px]"
                style={{ height: 120, backgroundColor: COLORS.skeleton }}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={COLORS.gradients.headerGreen}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top,
          height: headerHeight,
          paddingHorizontal: 16,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 5,
          zIndex: 10,
        }}
      >
        <View className="flex-row items-center justify-between h-[56px]">
          <Pressable
            onPress={handleGoBack}
            disabled={saving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            // 44px mirrors the old TOUCH.min constant.
            className="items-center justify-center w-[44px] h-[44px] rounded-[22px]"
            // One-off translucent-white overlay (no reusable token) on the
            // header gradient — kept inline.
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <Feather
              name="arrow-left"
              size={ICON.header}
              color={COLORS.textPrimary}
              style={{ opacity: saving ? 0.5 : 1 }}
            />
          </Pressable>

          <View className="items-center">
            <Text className="text-[17px] font-poppins-medium tracking-tight text-textPrimary">
              Edit Post
            </Text>
          </View>

          <Pressable
            onPress={handleSave}
            onPressIn={() => {
              if (canSave) {
                Animated.spring(pressAnim, {
                  toValue: 0.9,
                  useNativeDriver: true,
                  speed: 50,
                  bounciness: 4,
                }).start();
              }
            }}
            onPressOut={() => {
              Animated.spring(pressAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 20,
                bounciness: 8,
              }).start();
            }}
            disabled={!canSave || saving}
            accessibilityLabel="Save changes"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave || saving }}
          >
            <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
              {canSave ? (
                <View
                  className="flex-row items-center gap-[6px] rounded-full px-[16px] py-[8px] min-w-[80px] justify-center"
                  // Two-branch backgroundColor: the `saving` branch is a
                  // one-off translucent-white overlay with no reusable
                  // token, the other is the real `white` token — kept
                  // together inline rather than split across className.
                  style={{
                    backgroundColor: saving ? "rgba(255,255,255,0.3)" : COLORS.white,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.accentGreen} />
                  ) : (
                    <>
                      <Feather name="check" size={ICON.sm} color={COLORS.accentGreen} />
                      <Text className="text-[13px] font-poppins-medium text-accentGreen">
                        Save
                      </Text>
                    </>
                  )}
                </View>
              ) : (
                <View
                  className="items-center justify-center rounded-full px-[16px] py-[8px] min-w-[80px]"
                  // One-off translucent-white overlay — no reusable token.
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  <Text
                    className="text-[13px] font-poppins-medium"
                    // One-off translucent-black text — no reusable token.
                    style={{ color: "rgba(0,0,0,0.4)" }}
                  >
                    Save
                  </Text>
                </View>
              )}
            </Animated.View>
          </Pressable>
        </View>
      </LinearGradient>

      <SafeAreaView
        className="flex-1 bg-background"
        edges={["bottom", "left", "right"]}
      >
        {/* Imported from react-native-keyboard-controller, not RN core —
            not in the css-interop registry, so className is a no-op.
            Kept inline. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Card */}
            <View className="bg-surfaceWhite rounded-[20px] overflow-hidden border border-borderDefault">
              {/* Description Input */}
              <TextInput
                value={description}
                onChangeText={(t) => t.length <= MAX_CHARS && setDescription(t)}
                placeholder="What's on your mind? Share your thoughts..."
                placeholderTextColor={COLORS.placeholderText}
                multiline
                textAlignVertical="top"
                className="px-[16px] pt-[14px] pb-[10px] font-poppins text-[15px] leading-[22px] text-textPrimary min-h-[160px]"
              />

              {/* Image Section — grid of existing + newly-added images,
                  same layout/behavior as CreatePostScreen's image picker
                  so multi-image posts can actually be edited here instead
                  of only ever showing/replacing a single cover photo. */}
              {images.length > 0 ? (
                <View className="mx-[16px] mb-[12px]">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-[10px]"
                  >
                    {images.map((uri, index) => (
                      <View
                        key={`${uri}-${index}`}
                        className="rounded-[16px] overflow-hidden w-[140px] h-[140px]"
                      >
                        <Image source={{ uri }} className="flex-1" resizeMode="cover" />
                        <LinearGradient
                          colors={["rgba(0,0,0,0.45)", "transparent"]}
                          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 48 }}
                        />
                        <Pressable
                          onPress={() => removeImageAt(index)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          // 32px/16px mirror the old TOUCH.close constant.
                          className="absolute top-[8px] right-[8px] items-center justify-center w-[32px] h-[32px] rounded-[16px]"
                          // One-off translucent-black overlay — no
                          // reusable token. Kept inline.
                          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                        >
                          <Feather name="x" size={ICON.md} color="#fff" />
                        </Pressable>
                        {index === 0 && (
                          <View
                            className="absolute bottom-0 left-0 right-0 flex-row items-center px-[8px] py-[5px]"
                            // One-off translucent-black overlay — no
                            // reusable token. Kept inline.
                            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
                          >
                            <Feather name="star" size={ICON.xs} color={COLORS.accentGreen} />
                            <Text className="text-[10px] font-poppins ml-[4px] text-accentGreen">
                              Cover photo
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}

                    {images.length < MAX_IMAGES && (
                      <Pressable
                        onPress={openMediaSheet}
                        disabled={saving}
                        className={`items-center justify-center rounded-[16px] w-[140px] h-[140px] border-2 border-dashed border-accentGreen bg-categoryBg ${
                          saving ? "opacity-40" : "opacity-100"
                        }`}
                      >
                        <Feather name="plus" size={ICON.xl} color={COLORS.accentGreen} />
                        <Text className="text-[11px] font-poppins-sb mt-[4px] text-categoryText">
                          Add more
                        </Text>
                        <Text className="text-[10px] font-poppins mt-[1px] text-textSecondary">
                          {images.length}/{MAX_IMAGES}
                        </Text>
                      </Pressable>
                    )}
                  </ScrollView>
                </View>
              ) : (
                <Pressable
                  onPress={openMediaSheet}
                  onPressIn={() =>
                    Animated.spring(photoCardAnim, {
                      toValue: 0.97,
                      useNativeDriver: true,
                      speed: 40,
                      bounciness: 6,
                    }).start()
                  }
                  onPressOut={() =>
                    Animated.spring(photoCardAnim, {
                      toValue: 1,
                      useNativeDriver: true,
                      speed: 40,
                      bounciness: 6,
                    }).start()
                  }
                  disabled={saving}
                >
                  {/* BUG FIX: className was set directly on this
                      Animated.View — Animated.View isn't in the
                      css-interop registry, so "mx-[16px] mb-[12px]
                      items-center justify-center rounded-[16px]" was dead
                      code. Folded into the style object below; the whole
                      block stays inline together since it's driven by
                      photoCardAnim (Animated.Value transform). */}
                  <Animated.View
                    style={{
                      marginHorizontal: 16,
                      marginBottom: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      height: 170,
                      borderWidth: 2,
                      borderColor: COLORS.accentGreen,
                      borderStyle: "dashed",
                      borderRadius: 16,
                      backgroundColor: COLORS.categoryBg,
                      opacity: saving ? 0.4 : 1,
                      transform: [{ scale: photoCardAnim }],
                    }}
                  >
                    <View
                      className="items-center justify-center mb-[8px] w-[52px] h-[52px] rounded-[26px] bg-surfaceWhite"
                      // Shadow + elevation pair kept inline as one unit.
                      style={{
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <Feather name="camera" size={ICON.lg} color={COLORS.accentGreen} />
                    </View>
                    <Text className="text-[14px] font-poppins-sb text-categoryText">
                      Add photos
                    </Text>
                    <Text className="text-[12px] font-poppins mt-[2px] text-textSecondary">
                      Camera or gallery · up to {MAX_IMAGES}
                    </Text>
                  </Animated.View>
                </Pressable>
              )}

              {/* Character Counter */}
              <View className="flex-row items-center justify-end px-[16px] pb-[12px]">
                <View className="flex-row items-center gap-[4px]">
                  <Feather
                    name="type"
                    size={ICON.xs}
                    color={
                      description.length >= MAX_CHARS
                        ? COLORS.error
                        : COLORS.placeholderText
                    }
                  />
                  <Text
                    className={`text-[11px] font-poppins-medium ${
                      description.length >= MAX_CHARS
                        ? "text-error"
                        : "text-placeholderText"
                    }`}
                  >
                    {description.length}/{MAX_CHARS}
                  </Text>
                </View>
              </View>
            </View>

            {/* No separate tag chip row or "Add tags" pill anymore —
                Facebook-style, a #hashtag typed in the caption above is
                the only way a tag gets attached (see handleSave's
                tagsFromCaption() call, which is what actually reaches
                the backend's `tags` field). */}

            {/* Discard Card */}
            {hasChanges && (
              <Pressable
                onPress={handleGoBack}
                className="mt-[16px] items-center justify-center flex-row p-[14px] rounded-[20px] bg-surfaceWhite border border-borderDefault gap-[8px]"
                // Shadow + elevation pair kept inline as one unit.
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <Feather name="trash-2" size={ICON.md} color={COLORS.error || "#EF4444"} />
                <Text className="text-[13px] font-poppins-sb text-error">
                  Discard changes
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <MediaSourceSheet {...mediaPicker.sheetProps} />
    </View>
  );
}