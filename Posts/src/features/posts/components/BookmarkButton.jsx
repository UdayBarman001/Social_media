import { useRef } from "react";
import { Pressable, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";

export default function BookmarkButton({ active, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const bounce = () => {
    scaleAnim.setValue(0.85);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={() => {
        bounce();
        onPress();
      }}
      onPressIn={() => {
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }).start();
      }}
      hitSlop={10}
      className="items-center justify-center rounded-full w-10 h-10 bg-surfaceGray"
      accessibilityRole="button"
      accessibilityLabel={active ? "Remove bookmark" : "Bookmark post"}
      accessibilityState={{ selected: !!active }}
    >
      {/* Animated.View isn't in react-native-css-interop's registered
          component list, so this transform (driven by an Animated.Value)
          has to stay inline — there's no className equivalent to move it
          to. */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <MaterialCommunityIcons
          name={active ? "bookmark" : "bookmark-outline"}
          size={20}
          color={active ? COLORS.accentGreen : COLORS.iconLight}
        />
      </Animated.View>
    </Pressable>
  );
}