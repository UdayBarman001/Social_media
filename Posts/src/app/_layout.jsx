import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { FeedProvider } from "../features/feed/context/FeedContext";
import { LocalUserProvider, useUser } from "../shared/context/LocalUserContext";
import DisplayNamePrompt from "../shared/components/DisplayNamePrompt";
import { SheetHost } from "../shared/components/SheetHost";
import { useFonts } from "expo-font";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import {
  restoreQueryCache,
  setupQueryCachePersistence,
} from "../shared/queries/queryPersister";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid refetching data that's likely still fresh — cuts down on
      // redundant requests every time a screen refocuses.
      staleTime: 60 * 1000, // 1 minute
      // Default (3) with unbounded exponential backoff can leave a screen
      // stuck retrying for a long time against a slow/dead backend. Cap it.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
    mutations: {
      // Mutations (likes, posts, etc.) shouldn't silently auto-retry —
      // a failed write should surface to the user rather than re-fire.
      retry: 0,
    },
  },
});

SplashScreen.preventAutoHideAsync();

function AppShell({ fontsLoaded }) {
  const { name } = useUser();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  // Stack renders unconditionally — DisplayNamePrompt is a Modal sibling,
  // so the feed loads in the background while the prompt is visible.
  return (
    <ActionSheetProvider>
      <FeedProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="create" />
          <Stack.Screen name="search" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="tag/[tag]" />
        </Stack>
        <DisplayNamePrompt visible={!name} />
        {/* Mounted once, here, at the true app root — see SheetHost.jsx for
            why: it's what lets CommentSheet (and anything else) render
            outside both React Native's Modal/Dialog window and any
            FlatList's native clipping. Placed after everything else in
            this tree so portaled content paints on top. */}
        <SheetHost />
      </FeedProvider>
    </ActionSheetProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Hydrate query cache from AsyncStorage on boot for instant 0ms offline startup,
  // then subscribe to background debounced cache persistence.
  useEffect(() => {
    let cleanup = () => {};
    restoreQueryCache(queryClient).finally(() => {
      cleanup = setupQueryCachePersistence(queryClient);
    });
    return () => cleanup();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <SafeAreaProvider>
            <LocalUserProvider>
              <AppShell fontsLoaded={fontsLoaded} />
            </LocalUserProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}