import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  Share,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useFetchUserPostsQuery } from "../../../shared/queries/useFetchUserPostsQuery";
import { useFetchSavedPostsQuery } from "../../../shared/queries/useFetchSavedPostsQuery";
import { useFetchUserProfileQuery } from "../../../shared/queries/useFetchUserProfileQuery";
import { useFetchFollowCountsQuery } from "../../../shared/queries/useFetchFollowCountsQuery";
import { useFeedInteractions, useFeedMembership } from "../../feed/context/FeedContext";
import { useUser } from "../../../shared/context/LocalUserContext";
import { timeAgo } from "../../../shared/utils/format";
import COLORS from "../../../shared/theme/colors";
import BottomNav from "../../../shared/ui/BottomNav";
import ImageLightbox from "../../../shared/ui/ImageLightbox";
import ProgressiveImage from "../../../shared/ui/ProgressiveImage";
import EditProfileSheet from "../components/EditProfileSheet";

const { width } = Dimensions.get("window");
const HORIZONTAL_PADDING = 16;
const COLUMN_GAP = 10;
const CARD_WIDTH = (width - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / 2;
const IMAGE_HEIGHT = CARD_WIDTH; // uniform square media — consistent, predictable grid

// "Posts" already only shows this profile's own authored posts (filtered
// by author === id below), so it doubles as "My Posts" — no separate
// duplicate tab for that. "Likes" is replaced by "Saved": Saved is private
// (only the profile owner can see what they've bookmarked), so it's added
// conditionally for isOwnProfile only, see BASE_TABS usage below.
const BASE_TABS = ["Posts", "Media"];
const DEFAULT_BIO =
  "Sharing thoughts, field notes, and marketplace finds. Join the community!";

function ProfileStat({ label, value }) {
  return (
    <View className="items-center flex-1">
      <Text className="font-poppins-bd text-[18px] text-textPrimary">
        {value}
      </Text>
      <Text className="font-poppins text-[11px] text-placeholderText mt-0.5">
        {label}
      </Text>
    </View>
  );
}

// Tapping the image previews it fullscreen (matches the feed's PostCard
// behavior); tapping the caption/footer opens the post detail. Two
// distinct, discoverable targets instead of one Pressable that only
// sometimes did the thing it looked like it should do.
function ProfileGridItem({ item, index, onOpenPost, onOpenLightbox }) {
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];
  const hasImage = images.length > 0;

  return (
    <View
      // CARD_WIDTH is computed from Dimensions.get("window") at module load
      // — a real device-width-dependent value, not a fixed design constant,
      // so it can't be a static class. The marginLeft alternation (0 vs
      // COLUMN_GAP=10, a fixed known value) is expressed as a conditional
      // class below instead of staying inline.
      style={{ width: CARD_WIDTH }}
      className={`mb-2.5 rounded-xl bg-surfaceWhite border border-borderDefault overflow-hidden ${index % 2 === 0 ? "ml-0" : "ml-2.5"}`}
    >
      {hasImage && (
        <Pressable
           onPress={() => onOpenPost?.(item.id)}
          accessibilityRole="button"
          accessibilityLabel={
            images.length > 1 ? `View all ${images.length} images` : "View image"
          }
        >
          <ProgressiveImage
            uri={images[0]}
            width={CARD_WIDTH}
            height={IMAGE_HEIGHT}
            contentFit="cover"
          />
          {images.length > 1 && (
            <View
              pointerEvents="none"
              // rgba(26,24,27,0.72) isn't a named token in tailwind.config.js
              // — it's a one-off translucent overlay, not a reusable design
              // color, so adding it as a global token would pollute the
              // shared palette for a single badge. Kept inline; everything
              // else about this badge (layout/spacing/radius) is a class.
              style={{ backgroundColor: "rgba(26,24,27,0.72)" }}
              className="absolute top-2 right-2 flex-row items-center gap-1 rounded-full px-2 py-1"
            >
              <Feather name="layers" size={10} color={COLORS.white} />
              <Text className="font-poppins-sb text-[10px] text-white">
                {images.length}
              </Text>
            </View>
          )}
        </Pressable>
      )}
      <Pressable
        onPress={() => onOpenPost?.(item.id)}
        accessibilityRole="button"
        accessibilityLabel="Open post"
        className="p-3"
      >
        <Text
          numberOfLines={2}
          className="font-poppins text-[12.5px] text-textSecondary leading-[18px]"
        >
          {item.description}
        </Text>
        <View className="flex-row items-center mt-2.5">
          <View className="flex-row items-center gap-1 bg-categoryBg rounded-full px-2 py-1">
            <MaterialCommunityIcons name="leaf" size={11} color={COLORS.categoryText} />
            <Text className="font-poppins-sb text-[11px] text-categoryText">
              {item.likeCount}
            </Text>
          </View>
          <Text className="ml-auto font-poppins text-[10px] text-placeholderText">
            {timeAgo(item.createdAt)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const { id, tab: tabParam } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lightboxImages, setLightboxImages] = useState(null);
  const [editVisible, setEditVisible] = useState(false);

  const queryClient = useQueryClient();
  // Was useFetchPostsQuery() (the global feed, latest N posts across every
  // author) filtered client-side to `p.author === id` — see
  // useFetchUserPostsQuery's comment for why that silently hid a prolific
  // author's older posts. This queries the backend's own authorId filter
  // instead, so "this profile's posts" actually means all of them.
  const { data: authoredPosts = [], isLoading: loading } = useFetchUserPostsQuery(id);

  const { data: profileUser } = useFetchUserProfileQuery(id);
  const displayName = profileUser?.name || id;
  const displayHandle = profileUser?.handle || id?.toLowerCase()?.replace(/\s+/g, "");

  const { toggleFollow } = useFeedInteractions();
  const { followingIds } = useFeedMembership();
  const { userId: currentUserId } = useUser();
  const isOwnProfile = !!currentUserId && currentUserId === id;
  const isFollowing = !!followingIds?.has(id);

  // Saved is private (bookmarks belong to whoever is viewing their own
  // profile), so it's only offered as a tab on your own profile.
  const TABS = useMemo(
    () => (isOwnProfile ? [...BASE_TABS, "Saved"] : BASE_TABS),
    [isOwnProfile]
  );

  // Supports the deep link from the feed's hamburger menu ("Saved Posts" ->
  // /profile/<id>?tab=Saved) opening straight into the Saved tab; falls
  // back to Posts otherwise, and never lands on Saved on someone else's
  // profile even if a stale/crafted link asks for it.
  const [activeTab, setActiveTab] = useState(
    tabParam === "Saved" && isOwnProfile ? "Saved" : "Posts"
  );

  const { data: savedPosts, isLoading: savedLoading } = useFetchSavedPostsQuery(
    activeTab === "Saved" && isOwnProfile ? id : undefined
  );

  const { data: followCounts } = useFetchFollowCountsQuery(id);
  const followerCount = followCounts?.followers ?? 0;
  const followingCount = followCounts?.following ?? 0;

  const displayedPosts = useMemo(() => {
    if (activeTab === "Media") return authoredPosts.filter((p) => !!p.image);
    if (activeTab === "Saved") return savedPosts ?? [];
    return authoredPosts;
  }, [activeTab, authoredPosts, savedPosts]);

  const tabLoading = activeTab === "Saved" ? savedLoading : loading;

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    }, [queryClient])
  );

  const handleFollow = useCallback(() => {
    if (!currentUserId) {
      Alert.alert("Set a name first", "Pick a display name to follow people.");
      return;
    }
    toggleFollow(id, currentUserId);
  }, [currentUserId, id, toggleFollow]);

  const handleShareProfile = useCallback(() => {
    Share.share({
      message: `Check out ${displayName} on KrishiVerse!`,
    }).catch(() => {});
  }, [displayName]);

  const handleOpenPost = useCallback(
    (postId) => router.push(`/post/${postId}`),
    [router]
  );

  const handleNavPress = useCallback(
    (key) => {
      if (key === "home") router.replace("/");
      if (key === "profile") {
        const targetId = currentUserId || id;
        if (targetId) router.replace(`/profile/${encodeURIComponent(targetId)}`);
      }
      if (key === "community") router.replace("/");
    },
    [router, id, currentUserId]
  );

  const renderGridItem = useCallback(
    ({ item, index }) => (
      <ProfileGridItem
        item={item}
        index={index}
        onOpenPost={handleOpenPost}
        onOpenLightbox={(images) => setLightboxImages(images)}
      />
    ),
    [handleOpenPost]
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <StatusBar style="light" />

      <SafeAreaView
        className="flex-1 bg-background"
        edges={["bottom", "left", "right"]}
      >
        {tabLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={COLORS.accentGreen} size="large" />
          </View>
        ) : (
          <FlatList
            data={displayedPosts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerClassName="pb-10"
            columnWrapperStyle={{ justifyContent: "flex-start", paddingHorizontal: HORIZONTAL_PADDING }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {/* Facebook-style full-bleed cover, edge to edge */}
                <View style={{ height: 210 + insets.top }}>
                  <LinearGradient
                    colors={COLORS.gradients.headerGreen}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    // LinearGradient (expo-linear-gradient) is a third-party
                    // native component. NativeWind only auto-styles RN's own
                    // core components (View, Text, etc.) via className —
                    // third-party native components need explicit
                    // cssInterop registration, which this project doesn't
                    // have for LinearGradient (confirmed: every other
                    // LinearGradient usage in the codebase — TopBar,
                    // PostDetailScreen, EditPostScreen, CreatePostScreen —
                    // uses plain style, never className). Putting flex:1
                    // in className here silently did nothing, collapsing
                    // the gradient's height. Reverted to style.
                    style={{ flex: 1, paddingTop: insets.top }}
                  >
                    <View
                      pointerEvents="none"
                      className="absolute w-[200px] h-[200px] rounded-full -right-[70px]"
                      // Translucent white overlays with no config token — same
                      // reasoning as the "layers" badge overlay below (a
                      // one-off alpha color, not a reusable design token).
                      // Earlier these were converted to bg-white/[opacity]
                      // classes, but NativeWind v4 doesn't reliably support
                      // stacked arbitrary color+opacity modifiers (especially
                      // on border-color), which silently dropped this
                      // styling — reverted to inline rgba to restore it.
                      style={{ top: insets.top - 60, backgroundColor: "rgba(255,255,255,0.10)" }}
                    />
                    <View
                      pointerEvents="none"
                      className="absolute w-[130px] h-[130px] rounded-full -left-[45px] -bottom-[50px]"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                    />
                  </LinearGradient>

                  {/* Back button floating on the cover */}
                  <Pressable
                    onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    className="absolute left-3.5 w-[38px] h-[38px] rounded-full border items-center justify-center"
                    style={{
                      top: insets.top + 8,
                      backgroundColor: "rgba(255,255,255,0.18)",
                      borderColor: "rgba(255,255,255,0.32)",
                    }}
                  >
                    <Feather name="arrow-left" size={20} color={COLORS.categoryText} />
                  </Pressable>

                  {/* Header title — same type treatment as TopBar's title
                      (Poppins_700Bold, 20px, -0.3 letterSpacing, textPrimary
                      color), centered in the row alongside the back button. */}
                  <View
                    pointerEvents="none"
                    className="absolute left-0 right-0 h-[38px] items-center justify-center"
                    style={{ top: insets.top + 8 }}
                  >
                    <Text className="font-poppins-bd text-[20px] text-textPrimary tracking-[-0.3px]">
                      Profile
                    </Text>
                  </View>
                </View>

                {/* Avatar overlapping the cover, bottom-left — Facebook layout */}
                <View className="px-4 -mt-14">
                  <Pressable
                    onPress={() =>
                      profileUser?.avatarUrl && setLightboxImages([profileUser.avatarUrl])
                    }
                    disabled={!profileUser?.avatarUrl}
                    className="w-[112px] h-[112px] rounded-full border-4 border-white bg-accentGreen overflow-hidden items-center justify-center"
                  >
                    {profileUser?.avatarUrl ? (
                      <ProgressiveImage
                        uri={profileUser.avatarUrl}
                        width={112}
                        height={112}
                        contentFit="cover"
                      />
                    ) : (
                      <Text className="font-poppins-bd text-[38px] text-white">
                        {displayName?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    )}
                  </Pressable>
                </View>

                {/* Name & handle — left aligned under the avatar */}
                <View className="px-4 mt-3">
                  <Text className="font-poppins-bd text-[23px] text-textPrimary tracking-[-0.4px]">
                    {displayName ?? "Unknown"}
                  </Text>
                  <View className="self-start mt-[7px] bg-categoryBg rounded-full px-2.5 py-1">
                    <Text className="font-poppins-sb text-[12px] text-categoryText">
                      @{displayHandle ?? "user"}
                    </Text>
                  </View>

                  {/* Bio */}
                  <Text className="font-poppins text-[13.5px] text-textSecondaryLight leading-5 mt-2.5">
                    {profileUser?.bio || DEFAULT_BIO}
                  </Text>
                </View>

                {/* Facebook-style paired action pills */}
                <View className="flex-row items-center gap-2.5 mt-4 px-4">
                  {isOwnProfile ? (
                    <Pressable
                      onPress={() => setEditVisible(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Edit profile"
                      className="flex-1 h-11 rounded-full bg-accentGreen flex-row items-center justify-center gap-[7px]"
                    >
                      <Feather name="edit-2" size={15} color={COLORS.white} />
                      <Text className="font-poppins-sb text-[14px] text-white">
                        Edit Profile
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleFollow}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isFollowing }}
                      className={`flex-1 h-11 rounded-full flex-row items-center justify-center gap-[7px] border-borderDefault ${isFollowing ? "bg-surfaceGray border" : "bg-accentGreen border-0"}`}
                    >
                      <Feather
                        name={isFollowing ? "user-check" : "user-plus"}
                        size={15}
                        color={isFollowing ? COLORS.textSecondary : COLORS.white}
                      />
                      <Text
                        className={`font-poppins-sb text-[14px] ${isFollowing ? "text-textSecondary" : "text-white"}`}
                      >
                        {isFollowing ? "Following" : "Follow"}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={handleShareProfile}
                    accessibilityRole="button"
                    accessibilityLabel="Share profile"
                    className="flex-1 h-11 rounded-full bg-surfaceGray border border-borderDefault flex-row items-center justify-center gap-[7px]"
                  >
                    <Feather name="share-2" size={15} color={COLORS.textSecondary} />
                    <Text className="font-poppins-sb text-[14px] text-textSecondary">
                      Share
                    </Text>
                  </Pressable>
                </View>

                {/* Stats card */}
                <View className="mt-4 mx-4 bg-surfaceWhite rounded-xl border border-borderDefault py-3.5 flex-row items-stretch">
                  <ProfileStat label="Posts" value={authoredPosts.length} />
                  <View className="w-px bg-dividerLight my-1" />
                  <ProfileStat label="Followers" value={followerCount} />
                  <View className="w-px bg-dividerLight my-1" />
                  <ProfileStat label="Following" value={followingCount} />
                </View>

                {/* Tabs — same transparent + underline language as the app's TopBar filters */}
                <View className="flex-row mt-[18px] mb-3.5 px-4">
                  {TABS.map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <Pressable
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        className="items-center active:opacity-70 mr-[26px] py-1.5"
                      >
                        <Text
                          className={`text-[14px] ${isActive ? "font-poppins-sb tracking-[0.2px] text-textPrimary" : "font-poppins tracking-[0px] text-textSecondaryLight"}`}
                        >
                          {tab}
                        </Text>
                        <View
                          className={`mt-1.5 h-[3px] rounded-[1.5px] bg-accentGreen ${isActive ? "w-[18px]" : "w-0"}`}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center mt-[54px] px-8">
                <Feather name="image" size={32} color={COLORS.placeholderText} />
                <Text className="font-poppins-sb text-[16px] text-textPrimary mt-3">
                  No {activeTab.toLowerCase()} yet
                </Text>
                <Text className="font-poppins text-[13px] text-placeholderText mt-1.5 text-center leading-5">
                  When {displayName ?? "this user"} shares something, it'll appear here.
                </Text>
              </View>
            }
            renderItem={renderGridItem}
          />
        )}
      </SafeAreaView>

      <BottomNav active="profile" onPress={handleNavPress} />

      <ImageLightbox
        visible={!!lightboxImages}
        images={lightboxImages ?? []}
        initialIndex={0}
        onClose={() => setLightboxImages(null)}
      />

      {isOwnProfile && (
        <EditProfileSheet
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          userId={currentUserId}
          profileUser={profileUser}
        />
      )}
    </View>
  );
}