import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

export default function SkeletonCard() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    return () => pulseAnim.stopAnimation();
  }, [pulseAnim]);

  return (
    <View className="bg-background rounded-[14px] mb-[16px] p-[14px]">
      <Animated.View style={{ opacity: pulseAnim }}>
        <View className="flex-row items-center mb-[10px]">
          <View className="w-[42px] h-[42px] rounded-[21px] bg-dividerLight" />
          <View className="flex-1 ml-[10px]">
            <View className="h-[14px] w-[55%] rounded-[7px] mb-[6px] bg-dividerLight" />
            <View className="h-[12px] w-[35%] rounded-[6px] bg-dividerLight" />
          </View>
        </View>
        <View className="h-[200px] rounded-[10px] mb-[10px] bg-dividerLight" />
        <View className="h-[13px] rounded-[6px] mb-[6px] bg-dividerLight" />
        <View className="h-[13px] w-[60%] rounded-[6px] mb-[12px] bg-dividerLight" />
        <View className="flex-row gap-[8px]">
          <View className="h-[32px] w-[68px] rounded-[16px] bg-dividerLight" />
          <View className="h-[32px] w-[68px] rounded-[16px] bg-dividerLight" />
          <View className="h-[32px] flex-1 rounded-[16px] bg-dividerLight" />
        </View>
      </Animated.View>
    </View>
  );
}