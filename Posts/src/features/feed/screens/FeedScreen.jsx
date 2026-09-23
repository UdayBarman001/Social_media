import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { timeAgo } from "../../../shared/utils/format";
import COLORS from "../../../shared/theme/colors";
import TopBar from "../../../shared/ui/TopBar";
import BottomNav from "../../../shared/ui/BottomNav";
import PostCard from "../../posts/components/PostCard";
import SkeletonCard from "../components/SkeletonCard";
import { useFeed, useFeedPagination } from "../context/FeedContext";
import { useUser } from "../../../shared/context/LocalUserContext";
import { useNotificationsQuery } from "../../../shared/queries/useNotificationsQuery";
import { FILTERS } from "../constants";

export default function FeedScreen() {
  const router = useRouter();
  const { posts, loading, error, reload, loadMore, loadUserState } = useFeed();
  const { loadingMore, hasNextPage } = useFeedPagination();
  const { userId: storedUserId, user: currentUser } = useUser();
  const userId = storedUserId;
  const { data: notificationsData } = useNotificationsQuery(userId);
  const unreadNotificationsCount = notificationsData?.meta?.unreadCount || 0;

  // Only reload on the *first* focus (initial mount). Previously this ran
  // on every focus, so navigating back from post detail/comments/profile
  // triggered a full reload(): setLoading(true) unmounts the list in
  // favor of the skeleton screen, then setPosts() replaces the entire
  // array back to a fresh page 1 — discarding any page 2/3/etc the user
  // had already scrolled into and resetting scroll position. That's what
  // produced the jump/disappear-reappear/blank-space symptoms: it wasn't
  // a virtualization bug, it was the whole list being torn down and
  // rebuilt every time this screen regained focus.
  const didInitialLoad = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoad.current) {
        didInitialLoad.current = true;
        reload();
      }
    }, [reload]),
  );

  useEffect(() => {
    if (userId) loadUserState(userId);
  }, [userId, loadUserState]);

  const [refreshing, setRefreshing] = useState(false);
  const [anySheetOpen, setAnySheetOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch {
      // Non-fatal — reload() records error in FeedContext for UI display
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const categorize = (post) =>
    post.category ?? (post.image ? "Field notes" : "Marketplace");

  const filteredPosts = useMemo(() => {
    if (activeFilter === "All posts") return posts;
    return posts.filter((p) => categorize(p) === activeFilter);
  }, [posts, activeFilter]);

  // Stable, memoized so it's not re-created every render — avoids
  // re-mounting rows unnecessarily on unrelated FeedScreen re-renders
  // (e.g. menuVisible toggling).
  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => (
      <PostCard
        postId={item.id}
        avatarUri={
          item.author === userId
            ? (currentUser?.avatarUrl ?? null)
            : (item.authorAvatar ?? null)
        }
        authorId={item.author}
        name={
          item.author === userId
            ? currentUser?.name || item.authorName || item.author
            : item.authorName || item.author
        }
        isVerified={
          item.author === userId
            ? !!currentUser?.verified
            : (item.verified ?? item.authorVerified ?? false)
        }
        timeAgo={timeAgo(item.createdAt)}
        location={item.location ?? ""}
        primaryImageUri={item.image ?? ""}
        images={item.images ?? []}
        category={categorize(item)}
        caption={item.description}
        tags={item.tags}
        likeCount={String(item.likeCount)}
        commentCount={String(item.commentCount)}
        isAuthor={item.author === userId}
        onMenuOpenChange={setAnySheetOpen}
      />
    ),
    [userId, currentUser],
  );

  const handleNavPress = useCallback(
    (key) => {
      if (key === "home")
        Alert.alert("Home", "Hook this up to your home navigation.");
      if (key === "profile")
        router.replace(`/profile/${encodeURIComponent(userId)}`);
      if (key === "community") router.replace("/");
    },
    [router, userId],
  );

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={["left", "right"]}>
        <TopBar
          title="Community"
          filters={FILTERS}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onCreatePress={() => router.push("/create")}
          onNotificationPress={() => router.push("/notifications")}
          unreadCount={unreadNotificationsCount}
          onSearchPress={() => router.push("/search")}
        />

        {loading && filteredPosts.length === 0 ? (
          // Full-screen skeleton only for a genuine first load (no posts
          // yet). Pull-to-refresh also flips `loading` true, but the list
          // already has data at that point — gating on it here used to
          // unmount the whole FlashList (and every PostCard instance in
          // it) on every refresh, then remount everything from scratch
          // once the new page landed. That threw away each PostCard's
          // `loadedImages` state, so images expo-image already had cached
          // from moments earlier still had to show their loading shimmer
          // again — the "washed out, but only right after I pull to
          // refresh" symptom. RefreshControl's own `refreshing` spinner
          // already covers the "a refresh is happening" affordance, so
          // the list itself has no reason to disappear for it.
          <View className="flex-1 px-[20px] pt-[16px]">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-[32px]">
            <Feather
              name="cloud-off"
              size={28}
              color={COLORS.placeholderText}
            />
            <Text className="text-[13px] text-placeholderText mt-[10px] text-center">
              {error}. Check that the backend is running.
            </Text>
            <Pressable
              onPress={reload}
              className="mt-[16px] px-[16px] py-[8px] rounded-pill bg-accentGreen"
            >
              <Text className="text-white text-[13px] font-semibold">
                Retry
              </Text>
            </Pressable>
          </View>
        ) : filteredPosts.length === 0 ? (
          <View className="flex-1 items-center justify-center px-[32px]">
            <Feather
              name="file-text"
              size={32}
              color={COLORS.placeholderText}
            />
            <Text className="text-[13px] text-placeholderText mt-[10px] text-center">
              Nothing here yet for "{activeFilter}".
            </Text>
          </View>
        ) : (
          <FlashList
            data={filteredPosts}
            // `post.service.js#toClientPost` on the backend always maps
            // Mongo's `_id` to a plain `id: string` before the response
            // ever reaches the client — the client payload never contains
            // a raw `_id`, so `item.id` alone is the correct, stable,
            // unique key here. Never fall back to array index — index
            // changes when items are inserted/removed/reordered, and an
            // index-based key would make a recycled/reused cell show
            // stale state for whatever item shifted into that slot instead
            // of resetting it correctly.
            keyExtractor={keyExtractor}
            // FlashList (@shopify/flash-list) is not in
            // react-native-css-interop's registered component list — only
            // RN-core FlatList gets the className/contentContainerClassName
            // treatment. FlashList is a separate package with its own
            // native implementation, so both `style` and
            // `contentContainerStyle` here must stay as plain inline style
            // objects; there's no className equivalent to convert to.
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 100,
              paddingTop: 16,
            }}
            // FlashList v2 actually recycles cell views (reuses the same
            // mounted component instance instead of mount/unmount per row)
            // and auto-measures cells via Fabric, so none of FlatList's
            // windowSize/maxToRenderPerBatch/initialNumToRender/
            // removeClippedSubviews levers apply or are needed here.
            // drawDistance is FlashList's equivalent knob — how far ahead
            // of/behind the visible viewport to keep cells rendered, which
            // is what prevents the blank/empty-cell flash during a fast
            // scroll.
            drawDistance={3000}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View className="py-[20px] items-center">
                  <ActivityIndicator size="large" color={COLORS.accentGreen} />
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.accentGreen}
                colors={[COLORS.accentGreen]}
              />
            }
            renderItem={renderItem}
          />
        )}
      </SafeAreaView>

      <BottomNav
        active="community"
        onPress={handleNavPress}
      />
    </View>
  );
}