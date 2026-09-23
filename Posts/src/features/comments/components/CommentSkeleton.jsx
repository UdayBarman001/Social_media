import { View } from "react-native";

export default function CommentSkeleton() {
  return (
    <View className="flex-row py-3.5 border-b border-black/[0.04]">
      <View className="bg-surfaceGray rounded-full w-9 h-9" />
      <View className="flex-1 ml-3">
        <View className="bg-surfaceGray rounded mb-2 w-[40%] h-3" />
        <View className="bg-surfaceGray rounded mb-1.5 w-[85%] h-2.5" />
        <View className="bg-surfaceGray rounded w-[60%] h-2.5" />
      </View>
    </View>
  );
}