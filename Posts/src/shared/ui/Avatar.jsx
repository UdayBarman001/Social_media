import { View, Text } from "react-native";
import { Image } from "expo-image";

/** Circular avatar. Renders the image if `uri` is present, otherwise a
 *  green initials badge derived from `name`. */
export default function Avatar({ uri, name, size = 42 }) {
  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const imageUri =
    typeof uri === "string" && uri.trim()
      ? uri.trim()
      : typeof uri?.url === "string" && uri.url.trim()
      ? uri.url.trim()
      : null;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        className="bg-surfaceGray"
        // size is a runtime prop that varies per caller (different Avatar
        // instances render at different sizes) — width/height/borderRadius
        // can't be a static class since the value itself isn't static.
        style={{ width: size, height: size, borderRadius: size / 2 }}
        cachePolicy="memory-disk"
        transition={150}
      />
    );
  }

  return (
    <View
      className="items-center justify-center bg-accentGreen"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text
        className="text-white font-poppins-sb"
        // Same reason — font size scales with the size prop, not a fixed
        // value, so it can't be a static text-[Npx] class.
        style={{ fontSize: size * 0.31 }}
      >
        {initials}
      </Text>
    </View>
  );
}