module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    // react-native-reanimated 4.x split its compiler out into the
    // react-native-worklets package (both are in package.json). Without
    // this plugin registered, useAnimatedStyle/useSharedValue callbacks are
    // never turned into real worklets — they either throw at runtime or
    // silently no-op, which is why CommentSheet's keyboard-follow animation
    // (useReanimatedKeyboardAnimation + useAnimatedStyle) had no effect.
    // Must be listed last, per Reanimated's setup docs.
    plugins: ["react-native-worklets/plugin"],
  };
};