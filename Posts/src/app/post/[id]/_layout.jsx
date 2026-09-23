import { Stack } from "expo-router";

export default function PostLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="edit" options={{ headerShown: true, title: "Edit Post" }} />
    </Stack>
  );
}