import { View, Text, Pressable, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import COLORS from "../theme/colors";

const DEFAULT_FILTERS = ["All posts", "Field notes", "Marketplace"];

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

export default function TopBar({
  title = "Community",
  filters = DEFAULT_FILTERS,
  activeFilter,
  onFilterChange,
  onNotificationPress,
  onMenuPress,
  unreadCount = 0,
  onSearchPress,
  onCreatePress,

  gradientColors = COLORS.gradients.headerGreen,
  gradientStart = GRADIENT_START,
  gradientEnd = GRADIENT_END,
  statusBarStyle = "dark",

  // Feather (from @expo/vector-icons) renders as a native glyph and reads
  // its `color` prop as a JS color value — NativeWind doesn't restyle
  // vector-icons components by default (would need extra cssInterop
  // config), so this is the one visual prop here that structurally can't
  // become a className. Left as a color prop, unlike everything below.
  iconColor = COLORS.categoryText,
  iconSize = 20,

  // className-based now instead of raw color/pixel props: the only real
  // caller (FeedScreen) never overrode any of these, so there was no
  // actual use of runtime-arbitrary values to preserve. A future caller
  // customizes by passing Tailwind classes, same as any other className
  // prop, instead of a raw hex color or pixel number.
  titleClassName = "text-textPrimary",
  iconButtonClassName = "bg-transparent",
  activePillTextClassName = "text-textPrimary",
  inactivePillTextClassName = "text-textSecondary",
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleNotification = () => {
    if (onNotificationPress) return onNotificationPress();
    if (onMenuPress) return onMenuPress();
    router.push("/notifications");
  };

  const handleSearch = () => {
    if (onSearchPress) return onSearchPress();
    router.push("/search");
  };

  const handleCreate = () => {
    if (onCreatePress) return onCreatePress();
    router.push("/create");
  };

  const currentFilter = activeFilter ?? filters[0];

  return (
    <>
      <StatusBar style={statusBarStyle} />

      <LinearGradient
        colors={gradientColors}
        start={gradientStart}
        end={gradientEnd}
        // LinearGradient doesn't have cssInterop registered in this project
        // (confirmed against every other LinearGradient usage in the
        // codebase — none use className), so className here would silently
        // do nothing. zIndex moved back into style.
        style={{
          zIndex: 10,
          // insets.top is a runtime safe-area value — stays inline.
          paddingTop: insets.top + 8,
          // shadow/elevation platform split — same tradeoff as every other
          // sheet/panel in this codebase.
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.07,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        {/* Title row */}
        <View className="relative flex-row items-center justify-between px-4 pb-4 min-h-[44px]">
          {/* Centered Title (absolute dead-center of screen) */}
          <View
            pointerEvents="none"
            className="absolute left-0 right-0 top-0 bottom-4 items-center justify-center"
          >
            <Text className={`font-poppins-bd text-[20px] tracking-[-0.3px] ${titleClassName}`}>
              {title}
            </Text>
          </View>

          {/* Left action slot: Notification Bell */}
          <View className="flex-row items-center z-10">
            <Pressable
              onPress={handleNotification}
              hitSlop={12}
              accessibilityLabel={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              accessibilityRole="button"
              className={`items-center justify-center rounded-full border-0 h-10 w-10 active:scale-90 active:opacity-60 relative ${iconButtonClassName}`}
            >
              <Feather name="bell" size={iconSize} color={iconColor} />
              {unreadCount > 0 && (
                <View
                  pointerEvents="none"
                  className="absolute top-1 right-1 min-w-[17px] h-[17px] px-[3px] rounded-full bg-error items-center justify-center"
                  style={{
                    borderWidth: 1.5,
                    borderColor: "#FFFFFF",
                  }}
                >
                  <Text className="text-[9px] font-poppins-bd text-white leading-none text-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Right action slot */}
          <View className="flex-row items-center justify-end gap-1 z-10">
            <Pressable
              onPress={handleCreate}
              hitSlop={12}
              accessibilityLabel="Create post"
              accessibilityRole="button"
              className={`items-center justify-center rounded-full border-0 h-10 w-10 active:scale-90 active:opacity-60 ${iconButtonClassName}`}
            >
              <Feather name="plus" size={iconSize - 2} color={iconColor} />
            </Pressable>

            <Pressable
              onPress={handleSearch}
              hitSlop={12}
              accessibilityLabel="Search"
              accessibilityRole="button"
              className={`items-center justify-center rounded-full border-0 h-10 w-10 active:scale-90 active:opacity-60 ${iconButtonClassName}`}
            >
              <Feather name="search" size={iconSize - 2} color={iconColor} />
            </Pressable>
          </View>
        </View>

        {/* Transparent filter tabs with underline indicator */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          overScrollMode="never"
          contentContainerClassName="px-4 pb-[14px] pt-0.5 items-center"
        >
          {filters.map((filter) => {
            const active = filter === currentFilter;
            return (
              <Pressable
                key={filter}
                onPress={() => onFilterChange?.(filter)}
                hitSlop={8}
                className="items-center active:opacity-70 mr-[28px] py-1.5 bg-transparent border-0"
              >
                <Text
                  className={`text-[14px] ${active ? `font-poppins-sb tracking-[0.2px] ${activePillTextClassName}` : `font-poppins tracking-[0px] ${inactivePillTextClassName}`}`}
                >
                  {filter}
                </Text>

                {/* Active indicator line */}
                <View
                  className={`mt-1.5 h-[3px] rounded-[1.5px] bg-accentGreen ${active ? "w-[18px]" : "w-0"}`}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>
    </>
  );
}