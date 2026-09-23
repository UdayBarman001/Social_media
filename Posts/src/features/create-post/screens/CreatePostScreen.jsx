import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";
import { useCreatePost } from "../hooks/useCreatePost";
import { MAX_CHARS, MAX_IMAGES } from "../constants";
import MediaSourceSheet from "../components/MediaSourceSheet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ICON = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 22,
  header: 20,
};


export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const {
    description, setDescription,
    images,
    remainingSlots,
    location, setLocation,
    showLocationInput, setShowLocationInput,
    posting,
    canPost,
    mediaSheetVisible, setMediaSheetVisible,
    pressAnim,
    photoCardAnim,
    locationInputAnim,
    OPTION_PILLS,
    handlePost,
    pickFromCamera,
    pickFromGallery,
    handleMediaSheetDismissed,
    openMediaSheet,
    removeImage,
    clearLocation,
    router,
  } = useCreatePost();

  const headerHeight = insets.top + 56;

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />

      {/* LinearGradient (expo-linear-gradient) is a class component that
          spreads props straight onto a raw native host view via
          requireNativeComponent — verified it never passes through
          cssInterop, so className is always a no-op here. Stays fully
          inline; the shadow/elevation pair also stays inline as a unit
          per rule 2. */}
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
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            disabled={posting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="items-center justify-center w-[44px] h-[44px] rounded-[22px]"
            style={{
              // one-off translucent overlay on top of the gradient header,
              // not a reusable design token — intentionally inline.
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
          >
            <Feather
              name="arrow-left"
              size={ICON.header}
              color={COLORS.categoryText}
              style={{ opacity: posting ? 0.5 : 1 }}
            />
          </Pressable>

          <View className="items-center">
            <Text
              className="text-[17px] font-poppins-bd tracking-tight text-textPrimary"
            >
              Create Post
            </Text>
          </View>

          <Pressable
            onPress={handlePost}
            onPressIn={() => {
              if (canPost) {
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
            disabled={!canPost || posting}
            accessibilityLabel="Publish post"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPost || posting }}
          >
            <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
              {canPost ? (
                <View
                  className="flex-row items-center gap-[6px] rounded-full px-[16px] py-[8px] min-w-[80px] justify-center"
                  style={{
                    // posting=true swaps a design token for a one-off
                    // translucent white — can't express both branches as
                    // a single className, so the whole background stays
                    // a JS value here.
                    backgroundColor: posting
                      ? "rgba(255,255,255,0.3)"
                      : COLORS.white,
                  }}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color={COLORS.accentGreen} />
                  ) : (
                    <>
                      <Feather name="send" size={ICON.sm} color={COLORS.accentGreen} />
                      <Text
                        className="text-[13px] font-poppins-medium text-accentGreen"
                      >
                        Post
                      </Text>
                    </>
                  )}
                </View>
              ) : (
                <View
                  className="items-center justify-center rounded-full px-[16px] py-[8px] min-w-[80px]"
                  style={{
                    // one-off translucent overlay, not a reusable token.
                    backgroundColor: "rgba(255,255,255,0.2)",
                  }}
                >
                  <Text
                    className="text-[13px] font-poppins-medium"
                    style={{
                      // one-off translucent black, not a reusable token.
                      color: "rgba(0,0,0,0.5)",
                    }}
                  >
                    Post
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
        {/* KeyboardAvoidingView here is imported from
            react-native-keyboard-controller, not RN core — the
            css-interop registered list's "KeyboardAvoidingView" entry is
            for RN core's component of the same name, and I found no
            cssInterop/remapProps call in this codebase registering the
            keyboard-controller package's version. Not safe to assume
            it inherited registration just because the name matches, so
            this stays inline. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="p-[16px] pb-[40px]"
            showsVerticalScrollIndicator={false}
          >
            <View
              className="rounded-[20px] overflow-hidden border border-borderDefault bg-surfaceWhite"
              style={{
                // shadow/elevation kept inline as one unit (rule 2)
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <TextInput
                value={description}
                onChangeText={(t) => t.length <= MAX_CHARS && setDescription(t)}
                placeholder="Share your thoughts, experience or any update with the community..."
                placeholderTextColor={COLORS.placeholderText}
                multiline
                textAlignVertical="top"
                className="px-[16px] pt-[14px] pb-[10px] font-poppins text-[15px] leading-[22px] text-textPrimary min-h-[180px]"
              />

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
                        {/* LinearGradient — never registered, stays inline
                            (same reasoning as the header gradient above). */}
                        <LinearGradient
                          colors={["rgba(0,0,0,0.45)", "transparent"]}
                          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 48 }}
                        />
                        <Pressable
                          onPress={() => removeImage(index)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="absolute top-[8px] right-[8px] items-center justify-center w-[32px] h-[32px] rounded-[16px]"
                          style={{
                            // one-off translucent overlay atop a photo,
                            // not a reusable token.
                            backgroundColor: "rgba(0,0,0,0.55)",
                          }}
                        >
                          <Feather name="x" size={ICON.md} color={COLORS.accentGreen} />
                        </Pressable>
                        {index === 0 && (
                          <View
                            className="absolute bottom-0 left-0 right-0 flex-row items-center px-[8px] py-[5px]"
                            style={{
                              // one-off translucent overlay, not a
                              // reusable token.
                              backgroundColor: "rgba(0,0,0,0.4)",
                            }}
                          >
                            <Feather name="star" size={ICON.xs} color={COLORS.accentGreen} />
                            <Text
                              className="text-[10px] font-poppins ml-[4px] text-accentGreen"
                            >
                              Cover photo
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}

                    {images.length < MAX_IMAGES && (
                      <Pressable
                        onPress={openMediaSheet}
                        disabled={posting}
                        className={`items-center justify-center rounded-[16px] w-[140px] h-[140px] border-2 border-accentGreen border-dashed bg-categoryBg ${posting ? "opacity-[0.4]" : "opacity-100"}`}
                      >
                        <Feather name="plus" size={ICON.xl} color={COLORS.accentGreen} />
                        <Text
                          className="text-[11px] font-poppins-semibold mt-[4px] text-categoryText"
                        >
                          Add more
                        </Text>
                        <Text
                          className="text-[10px] font-poppins mt-[1px] text-textSecondary"
                        >
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
                  disabled={posting}
                >
                  {/* BUG FIX: className was previously set directly on
                      this Animated.View ("mx-[16px] mb-[12px] items-center
                      justify-center rounded-[16px]") — this file's
                      `Animated` import is RN core's Animated (not
                      Reanimated), which is equally unregistered in
                      css-interop, so that className was dead code and
                      this card was never actually centered/margined.
                      Folded into style, alongside the scale transform
                      which has to stay inline regardless. */}
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
                      opacity: posting ? 0.4 : 1,
                      transform: [{ scale: photoCardAnim }],
                    }}
                  >
                    <View
                      className="items-center justify-center mb-[8px] w-[52px] h-[52px] rounded-[26px] bg-surfaceWhite"
                      style={{
                        // shadow/elevation kept inline as one unit (rule 2)
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <Feather name="camera" size={ICON.lg} color={COLORS.accentGreen} />
                    </View>
                    <Text
                      className="text-[14px] font-poppins-semibold text-categoryText"
                    >
                      Add photos
                    </Text>
                    <Text
                      className="text-[12px] font-poppins mt-[2px] text-textSecondary"
                    >
                      Camera or gallery · up to {MAX_IMAGES}
                    </Text>
                  </Animated.View>
                </Pressable>
              )}

              {location.trim() && !showLocationInput ? (
                <View className="flex-row items-center px-[16px] mb-[10px]">
                  <Pressable
                    onPress={() => setShowLocationInput(true)}
                    className="flex-row items-center rounded-full bg-categoryBg pl-[12px] pr-[8px] py-[7px] gap-[6px]"
                  >
                    <Feather name="map-pin" size={ICON.sm} color={COLORS.categoryText} />
                    <Text
                      className="text-[12.5px] font-poppins-semibold text-categoryText"
                    >
                      {location}
                    </Text>
                    <Pressable
                      onPress={clearLocation}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      className="items-center justify-center ml-[2px] w-[36px] h-[36px] rounded-[18px]"
                      style={{
                        // one-off translucent overlay, not a reusable
                        // token.
                        backgroundColor: "rgba(0,0,0,0.08)",
                      }}
                    >
                      <Feather name="x" size={ICON.xs} color={COLORS.categoryText} />
                    </Pressable>
                  </Pressable>
                </View>
              ) : null}

              {showLocationInput && (
                // BUG FIX: same className-on-Animated.View issue as the
                // photo placeholder above ("mx-[16px] mb-[12px] flex-row
                // items-center rounded-[14px] px-[14px]" was dead code).
                // Folded in alongside the animated opacity/transform.
                <Animated.View
                  style={{
                    marginHorizontal: 16,
                    marginBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    backgroundColor: COLORS.surfaceGray,
                    opacity: locationInputAnim,
                    transform: [
                      {
                        translateY: locationInputAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-10, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <Feather name="map-pin" size={ICON.md} color={COLORS.accentGreen} />
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Add your location..."
                    placeholderTextColor={COLORS.placeholderText}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => setShowLocationInput(false)}
                    onBlur={() => setShowLocationInput(false)}
                    className="flex-1 py-[12px] px-[10px] text-[14px] font-poppins text-textPrimary"
                  />
                  {location.length > 0 && (
                    <Pressable
                      onPress={() => setLocation("")}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      className="items-center justify-center w-[36px] h-[36px] rounded-[18px]"
                      style={{
                        // one-off translucent overlay, not a reusable
                        // token.
                        backgroundColor: "rgba(0,0,0,0.06)",
                      }}
                    >
                      <Feather name="x" size={ICON.xs} color={COLORS.textSecondary} />
                    </Pressable>
                  )}
                </Animated.View>
              )}

              {/* No separate tag chip row anymore — Facebook-style, a
                  #hashtag typed in the caption above is the only way a
                  tag gets attached. It's shown highlighted once the post
                  renders (RichCaption.jsx) and is what tagsFromCaption()
                  in hashtags.js pulls out to become the backend's `tags`
                  field on submit. */}

              <View className="flex-row items-center justify-end px-[16px] pb-[12px]">
                {description.length > 0 && (
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
                      className={`text-[11px] font-poppins-medium ${description.length >= MAX_CHARS ? "text-error" : "text-placeholderText"}`}
                    >
                      {description.length}/{MAX_CHARS}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View
              className="mt-[16px] px-[14px] py-[16px] rounded-[20px] border border-borderDefault bg-surfaceWhite"
              style={{
                // shadow/elevation kept inline as one unit (rule 2)
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text
                className="text-[13px] font-poppins-semibold px-[6px] mb-[14px] text-textSecondary"
              >
                Add to your post
              </Text>
              <View className="flex-row gap-[8px]">
                {OPTION_PILLS.map((opt) => (
                  <Pressable
                    key={opt.key}
                    onPress={opt.onPress}
                    className="items-center justify-center flex-1 py-[12px] rounded-[16px] border"
                    style={{
                      // opt.active swaps a token for a computed
                      // alpha-suffixed hex string (`${accentGreen}15`),
                      // not itself a config token — stays a JS value.
                      backgroundColor: opt.active
                        ? `${COLORS.accentGreen}15`
                        : COLORS.surfaceGray,
                      borderColor: opt.active
                        ? `${COLORS.accentGreen}30`
                        : "transparent",
                    }}
                  >
                    <View
                      className={`items-center justify-center mb-[8px] w-[44px] h-[44px] rounded-[14px] ${opt.active ? "bg-accentGreen" : "bg-surfaceWhite"}`}
                      style={{
                        // shadow/elevation kept inline as one unit
                        // (rule 2) — also dynamic per opt.active.
                        shadowColor: opt.active ? COLORS.accentGreen : "#000",
                        shadowOffset: { width: 0, height: opt.active ? 2 : 1 },
                        shadowOpacity: opt.active ? 0.25 : 0.05,
                        shadowRadius: opt.active ? 6 : 2,
                        elevation: opt.active ? 3 : 1,
                      }}
                    >
                      <Feather
                        name={opt.iconName}
                        size={ICON.lg}
                        color={opt.active ? "#000000" : COLORS.textSecondary}
                      />
                    </View>
                    <Text
                      className={`text-[12px] font-poppins-semibold ${opt.active ? "text-accentGreen" : "text-textSecondary"}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <MediaSourceSheet
        visible={mediaSheetVisible}
        onClose={() => setMediaSheetVisible(false)}
        onPickCamera={pickFromCamera}
        onPickGallery={pickFromGallery}
        onDismiss={handleMediaSheetDismissed}
      />
    </View>
  );
}