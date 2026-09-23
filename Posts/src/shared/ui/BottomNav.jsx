import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import COLORS from "../theme/colors";

// Flat, full-width bar docked to the bottom of the screen — white background,
// thin top border, 3 items each rendered as icon-above-label, with the active
// tab getting a light-green pill behind its icon plus green icon/label color.
// No animation — active state is applied directly via conditional style.
const TABS = [
  { key: "home", label: "Home", icon: "home" },
  { key: "community", label: "Community", icon: "users" },
  { key: "profile", label: "Profile", icon: "user" },
];

const NavItem = memo(function NavItem({ tab, isActive, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center py-1.5"
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isActive }}
    >
      <View
        className={`items-center justify-center px-[18px] py-1.5 rounded-[999px] ${isActive ? "bg-categoryBg" : "bg-transparent"}`}
      >
        <Feather
          name={tab.icon}
          size={22}
          strokeWidth={2.2}
          color={isActive ? COLORS.accentGreen : COLORS.iconLight}
        />
      </View>
      <Text
        className={`font-poppins-medium text-[11px] mt-0.5 ${isActive ? "text-accentGreen" : "text-iconLight"}`}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
});

export default function BottomNav({ onPress, hidden = false, active = "home" }) {
  const insets = useSafeAreaInsets();

  if (hidden) return null;

  return (
    <View
      className="flex-row bg-white border-t border-borderDefault pt-1.5"
      style={{
        // Runtime safe-area value — stays inline, same reasoning as every
        // other insets.bottom usage in this codebase.
        paddingBottom: insets.bottom || 8,
      }}
    >
      {TABS.map((tab) => (
        <NavItem
          key={tab.key}
          tab={tab}
          isActive={active === tab.key}
          onPress={() => onPress?.(tab.key)}
        />
      ))}
    </View>
  );
}