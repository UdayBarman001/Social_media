import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  Animated,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";
import { timeAgo } from "../../../shared/utils/format";
import { useUserSearch } from "../hooks/useUserSearch";
import { usePostSearch } from "../hooks/usePostSearch";

function initialsOf(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCount(n) {
  if (!n || n < 1) return "0";
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

// ── Avatar (image with graceful initials fallback) ────────────────────────
function Avatar({ uri, name, size = 44 }) {
  if (uri) {
    return (
      <View
        className="border border-[#ECECEC] bg-white"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: 2,
        }}
      >
        <Image
          source={{ uri }}
          style={{
            width: size - 4,
            height: size - 4,
            borderRadius: (size - 4) / 2,
          }}
        />
      </View>
    );
  }
  return (
    <View
      className="items-center justify-center border border-[#ECECEC]"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.accentGreen,
      }}
    >
      <Text
        className="font-poppins-semibold text-white"
        style={{ fontSize: size * 0.34 }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

// ── Shimmering skeleton rows ──────────────────────────────────────────────
function useShimmer() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);
  return pulseAnim;
}

function SkeletonRow({ variant }) {
  const opacity = useShimmer();

  return (
    <Animated.View
      style={{ opacity }}
      className="mx-[16px] mb-[12px] p-[16px] flex-row items-center rounded-2xl bg-white border border-[#ECECEC]"
    >
      <View
        className="bg-[#F2F2F2]"
        style={{
          width: variant === "people" ? 48 : 56,
          height: variant === "people" ? 48 : 56,
          borderRadius: variant === "people" ? 24 : 12,
        }}
      />
      <View className="flex-1 ml-[14px]" style={{ gap: 10 }}>
        <View
          className="bg-[#F2F2F2] rounded-full"
          style={{ width: "45%", height: 12 }}
        />
        <View
          className="bg-[#F2F2F2] rounded-full"
          style={{ width: "70%", height: 10 }}
        />
      </View>
    </Animated.View>
  );
}

// ── People results ────────────────────────────────────────────────────────
function UserRow({ user, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: COLORS.dividerLight }}
      className="mx-[16px] mb-[12px] p-[16px] flex-row items-center rounded-2xl bg-white border border-[#ECECEC] active:opacity-80"
      style={{
        gap: 14,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      <Avatar uri={user.avatarUrl} name={user.name} size={48} />

      <View className="flex-1 min-w-0" style={{ gap: 6 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text
            className="text-[15px] font-poppins-semibold text-[#1A181B] tracking-tight"
            numberOfLines={1}
          >
            {user.name}
          </Text>
          {!!user.verified && (
            <MaterialCommunityIcons
              name="check-decagram"
              size={14}
              color={COLORS.accentGreen}
            />
          )}
        </View>

        <View className="flex-row items-center" style={{ gap: 8 }}>
          {!!user.handle && (
            <Text
              className="text-[12.5px] font-poppins text-[#7A7A7A]"
              numberOfLines={1}
            >
              @{user.handle}
            </Text>
          )}
          <View className="w-[3px] h-[3px] rounded-full bg-[#AAAAAA]" />
          <Text className="text-[12.5px] font-poppins text-[#AAAAAA]">
            {formatCount(user.postCount)}{" "}
            {user.postCount === 1 ? "post" : "posts"}
          </Text>
        </View>
      </View>

      <View className="w-[28px] h-[28px] rounded-full bg-[#F2F2F2] items-center justify-center">
        <Feather
          name="chevron-right"
          size={14}
          color={COLORS.placeholderText}
        />
      </View>
    </Pressable>
  );
}

// ── Post results ───────────────────────────────────────────────────────────
function PostRow({ post, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: COLORS.dividerLight }}
      className="mx-[16px] mb-[12px] p-[16px] flex-row rounded-2xl bg-white border border-[#ECECEC] active:opacity-80"
      style={{
        gap: 14,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      {post.image ? (
        <Image
          source={{ uri: post.image }}
          className="bg-[#F2F2F2]"
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
          }}
        />
      ) : (
        <View
          className="items-center justify-center bg-[#F2F2F2]"
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
          }}
        >
          <Feather name="image" size={20} color={COLORS.placeholderText} />
        </View>
      )}

      <View className="flex-1 min-w-0" style={{ gap: 6 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text
            className="text-[13.5px] font-poppins-semibold text-[#1A181B] tracking-tight"
            numberOfLines={1}
          >
            {post.authorName || "Unknown"}
          </Text>
          {!!post.authorVerified && (
            <MaterialCommunityIcons
              name="check-decagram"
              size={12}
              color={COLORS.accentGreen}
            />
          )}
          {!!post.createdAt && (
            <>
              <Text className="text-[11px] text-[#AAAAAA]">·</Text>
              <Text className="text-[11.5px] font-poppins text-[#7A7A7A]">
                {timeAgo(post.createdAt)}
              </Text>
            </>
          )}
        </View>

        <Text
          className="text-[13px] font-poppins text-[#555555] leading-[19px]"
          numberOfLines={2}
        >
          {post.description}
        </Text>

        <View className="flex-row items-center mt-[2px]" style={{ gap: 16 }}>
          <View
            className="flex-row items-center px-[8px] py-[3px] rounded-full bg-[#F4FBF5]"
            style={{ gap: 4 }}
          >
            <MaterialCommunityIcons
              name="leaf"
              size={11}
              color={COLORS.accentGreen}
            />
            <Text className="text-[11px] font-poppins-semibold text-[#16A34A]">
              {formatCount(post.likeCount)}
            </Text>
          </View>
          <View
            className="flex-row items-center px-[8px] py-[3px] rounded-full bg-[#F2F2F2]"
            style={{ gap: 4 }}
          >
            <Feather
              name="message-circle"
              size={11}
              color={COLORS.placeholderText}
            />
            <Text className="text-[11px] font-poppins text-[#7A7A7A]">
              {formatCount(post.commentCount)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── Empty / status states ───────────────────────────────────────────────────
function StatusState({ icon, title, subtitle }) {
  return (
    <View
      className="flex-1 items-center justify-center px-[32px]"
      style={{ gap: 16 }}
    >
      <View
        className="items-center justify-center mb-[4px]"
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: "#F4FBF5",
        }}
      >
        <Feather name={icon} size={28} color={COLORS.accentGreen} />
      </View>
      <Text className="text-[16px] font-poppins-semibold text-[#1A181B] text-center tracking-tight">
        {title}
      </Text>
      {!!subtitle && (
        <Text className="text-[13px] font-poppins text-[#7A7A7A] text-center leading-[20px] max-w-[280px]">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const TABS = ["People", "Posts"];

function getItemId(item) {
  return item?.id ?? item?._id ?? item?.userId ?? item?.postId ?? null;
}

function getUniqueListKey(item, index, seen) {
  const rawId = getItemId(item);

  if (rawId !== null && rawId !== undefined && String(rawId).length > 0) {
    const base = String(rawId);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return occurrence === 0 ? base : `${base}-${occurrence}`;
  }

  return `search-result-${index}`;
}

export default function SearchScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const userSearch = useUserSearch();
  const postSearch = usePostSearch();

  const query = userSearch.query;
  const setQuery = (text) => {
    userSearch.setQuery(text);
    postSearch.setQuery(text);
  };

  const isPeopleTab = activeTab === "People";
  const rawResults = isPeopleTab ? userSearch.users : postSearch.posts;
  const loading = isPeopleTab ? userSearch.loading : postSearch.loading;
  const error = isPeopleTab ? userSearch.error : postSearch.error;

  const seenKeys = new Map();
  const results = rawResults.map((item, index) => ({
    item,
    key: getUniqueListKey(item, index, seenKeys),
  }));

  const isInitialLoad =
    loading && results.length === 0 && query.trim().length > 0;
  const isRefetching = loading && results.length > 0;

  return (
    <SafeAreaView
      className="flex-1 bg-[#F5F5F5]"
      edges={["top", "left", "right"]}
    >
      {/* Search bar */}
      <View
        className="flex-row items-center px-[16px] pt-[12px] pb-[16px]"
        style={{ gap: 12 }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={8}
          className="w-[40px] h-[40px] rounded-full bg-white items-center justify-center border border-[#ECECEC] active:opacity-70"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <Feather name="arrow-left" size={18} color={COLORS.textPrimary} />
        </Pressable>

        <View
          className="flex-1 flex-row items-center px-[16px] h-[48px] rounded-full bg-white border border-[#ECECEC]"
          style={{
            gap: 10,
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          }}
        >
          <Feather name="search" size={16} color={COLORS.placeholderText} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={
              isPeopleTab
                ? "Search"
                : "Search posts by caption"
            }
            placeholderTextColor={COLORS.placeholderText}
            autoFocus
            returnKeyType="search"
            className="flex-1 text-[14px] font-poppins text-[#1A181B]"
          />
          {isRefetching ? (
            <ActivityIndicator size="small" color={COLORS.accentGreen} />
          ) : (
            query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={8}
                className="w-[22px] h-[22px] rounded-full bg-[#F2F2F2] items-center justify-center active:opacity-70"
              >
                <Feather name="x" size={12} color={COLORS.textSecondary} />
              </Pressable>
            )
          )}
        </View>
      </View>

      {/* People / Posts tabs */}
      <View className="px-[16px] pb-[16px]">
        <View
          className="flex-row p-[4px] rounded-2xl bg-[#EFEFEF]"
          style={{ gap: 4 }}
        >
          {TABS.map((tab) => {
            const active = tab === activeTab;
            const count =
              tab === "People"
                ? userSearch.users.length
                : postSearch.posts.length;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 flex-row items-center justify-center py-[10px] rounded-xl ${
                  active ? "bg-[#16A34A]" : "bg-transparent"
                }`}
                style={active ? { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : {}}
              >
                <Text
                  className={`text-[13px] font-poppins-semibold ${
                    active ? "text-white" : "text-[#555555]"
                  }`}
                >
                  {tab}
                </Text>
                {query.trim().length > 0 && count > 0 && (
                  <View
                    className={`min-w-[20px] h-[20px] rounded-full px-[5px] items-center justify-center ml-[6px] ${
                      active ? "bg-white/20" : "bg-[#F2F2F2]"
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-poppins-semibold ${
                        active ? "text-white" : "text-[#555555]"
                      }`}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Results */}
      {isInitialLoad ? (
        <View className="pt-[6px]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} variant={isPeopleTab ? "people" : "post"} />
          ))}
        </View>
      ) : error ? (
        <StatusState
          icon="cloud-off"
          title="Couldn't load results"
          subtitle={error}
        />
      ) : !query.trim() ? (
        <StatusState
          icon={isPeopleTab ? "users" : "file-text"}
          title={isPeopleTab ? "Find people" : "Find posts"}
          subtitle={
            isPeopleTab
              ? "Search for people in the community by name or @handle"
              : "Search posts by their caption"
          }
        />
      ) : results.length === 0 ? (
        <StatusState
          icon="search"
          title="No results"
          subtitle={
            isPeopleTab
              ? `No people found for "${query}"`
              : `No posts found for "${query}"`
          }
        />
      ) : isPeopleTab ? (
        <FlashList
          data={results}
          keyExtractor={(entry) => entry.key}
          className="flex-1"
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: entry }) => {
            const item = entry.item;
            const itemId = getItemId(item);
            return (
              <UserRow
                user={item}
                onPress={() =>
                  itemId != null && router.push(`/profile/${itemId}`)
                }
              />
            );
          }}
        />
      ) : (
        <FlashList
          data={results}
          keyExtractor={(entry) => entry.key}
          className="flex-1"
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: entry }) => {
            const item = entry.item;
            const itemId = getItemId(item);
            return (
              <PostRow
                post={item}
                onPress={() => itemId != null && router.push(`/post/${itemId}`)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}