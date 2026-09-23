import { useRef } from "react";
import { Pressable, Animated, Text } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";

/** Pill button for the post's Like/Share row. Pass `leaf` for the
 *  leaf-icon "Like" variant instead of a Feather `icon`. */
export default function ActionButton({ icon, label, active, onPress, leaf }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const bounce = () => {
    scaleAnim.setValue(0.92);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
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
      className="flex-row items-center justify-center px-4 py-2.5 rounded-full bg-surfaceGray active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
    >
      {/* Animated.View is not in react-native-css-interop's registered
          component list (RN-core Animated, same as Reanimated's wrapper,
          is never patched) — className is a no-op here regardless. The
          whole style object stays inline as one unit since the transform
          is driven by an Animated.Value. */}
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          transform: [{ scale: scaleAnim }],
        }}
      >
        {leaf ? (
          <MaterialCommunityIcons
            name="leaf"
            size={18}
            color={active ? COLORS.accentGreen : COLORS.iconLight}
          />
        ) : (
          <Feather
            name={icon}
            size={16}
            color={active ? COLORS.accentGreen : COLORS.iconLight}
          />
        )}
        <Text
          className={`font-poppins-sb text-[12.5px] ml-1.5 ${
            active ? "text-accentGreen" : "text-textSecondary"
          }`}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}