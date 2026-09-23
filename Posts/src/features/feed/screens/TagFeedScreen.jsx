import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";
import { timeAgo } from "../../../shared/utils/format";
import { fetchPostsPage } from "../../../shared/services/api";
import { useUser } from "../../../shared/context/LocalUserContext";
import PostCard from "../../posts/components/PostCard";
import SkeletonCard from "../components/SkeletonCard";

const categorize = (post) =>
  post.category ?? (post.image ? "Field notes" : "Marketplace");

/** Posts filtered to a single hashtag — reached by tapping a #hashtag in
 *  a caption (RichCaption), same as tapping a hashtag on Facebook opens
 *  its own results feed.
 *
 *  Deliberately NOT built on top of FeedContext's global `posts` list:
 *  that context is the one, app-wide feed shown on the Community screen,
 *  and reload()/loadMore() there have no tag filter at all. Bolting a
 *  tag filter onto it would mean either (a) the global feed and this
 *  screen fight over the same `posts` array, or (b) adding tag-aware
 *  branching into every consumer of that context for a feed that's only
 *  ever visible on this one screen. Local state here is simpler and
 *  can't leak into the main feed you came from.
 *
 *  PostCard itself still works normally: its like/bookmark/follow/
 *  comment handlers come from FeedInteractionContext (via
 *  useFeedInteractions()), which is the same global provider regardless
 *  of which posts array feeds a given PostCard instance — so likes,
 *  comments, bookmarks, etc. all behave identically here and on the
 *  main feed. */
export default function TagFeedScreen() {
  const router = useRouter();
  const { tag: rawTag } = useLocalSearchParams();
  const tag = decodeURIComponent(rawTag ?? "");
  const { userId: storedUserId, user: currentUser } = useUser();
  const userId = storedUserId;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const loadingMoreRef = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchPostsPage({ page: 1, tag })
      .then(({ posts: fetched, meta }) => {
        setPosts(fetched);
        setNextCursor(meta?.nextCursor ?? null);
        setHasNextPage(!!meta?.hasNextPage);
      })
      .catch((err) => {
        setError(err.message || "Couldn't load posts");
      })
      .finally(() => setLoading(false));
  }, [tag]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || loadingMore || loading || !hasNextPage || !nextCursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    // tag is resent here alongside the cursor — see api.js#fetchPostsPage:
    // the backend's cursor only signs { createdAt, id }, not the tag
    // filter, so it has to be passed on every request, not just page 1.
    fetchPostsPage({ cursor: nextCursor, tag })
      .then(({ posts: fetched, meta }) => {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of fetched) {
            if (!seen.has(p.id)) merged.push(p);
          }
          return merged;
        });
        setNextCursor(meta?.nextCursor ?? null);
        setHasNextPage(!!meta?.hasNextPage);
      })
      .catch(() => {
        // Non-fatal, same as FeedContext's loadMore — leave hasNextPage
        // as-is so scrolling again just retries.
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [tag, nextCursor, hasNextPage, loadingMore, loading]);

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
      />
    ),
    [userId, currentUser],
  );

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={["left", "right", "top"]}>
        {/* Simple back + "#tag" header — this is a results page reached
            by tapping a hashtag, not the main Community screen, so it
            doesn't need TopBar's filters/menu/search/create affordances. */}
        <View
          className="flex-row items-center px-4 py-3 border-b"
          style={{ borderColor: COLORS.borderDefault }}
        >
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            hitSlop={12}
            className="mr-3 items-center justify-center rounded-full w-9 h-9"
            style={{ backgroundColor: COLORS.surfaceGray }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={18} color={COLORS.textPrimary} />
          </Pressable>
          <Text
            className="text-[17px] font-poppins-semibold flex-1"
            style={{ color: COLORS.textPrimary }}
            numberOfLines={1}
          >
            #{tag}
          </Text>
        </View>

        {loading && posts.length === 0 ? (
          <View className="flex-1 px-[20px] pt-[16px]">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-[32px]">
            <Feather name="cloud-off" size={28} color={COLORS.placeholderText} />
            <Text className="text-[13px] text-placeholderText mt-[10px] text-center">
              {error}. Check that the backend is running.
            </Text>
            <Pressable
              onPress={load}
              className="mt-[16px] px-[16px] py-[8px] rounded-pill bg-accentGreen"
            >
              <Text className="text-white text-[13px] font-semibold">Retry</Text>
            </Pressable>
          </View>
        ) : posts.length === 0 ? (
          <View className="flex-1 items-center justify-center px-[32px]">
            <Feather name="hash" size={32} color={COLORS.placeholderText} />
            <Text className="text-[13px] text-placeholderText mt-[10px] text-center">
              No posts tagged #{tag} yet.
            </Text>
          </View>
        ) : (
          <FlashList
            data={posts}
            keyExtractor={keyExtractor}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 40,
              paddingTop: 16,
            }}
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
            renderItem={renderItem}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
