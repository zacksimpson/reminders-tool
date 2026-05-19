import { Pressable, type PressableProps } from "react-native";
import { triggerHaptic } from "@/utils/haptics";

export const HapticPressable = (props: PressableProps) => {
  return (
    <Pressable
      {...props}
      android_disableSound={true}
      android_ripple={null}
      onPress={(event) => {
        triggerHaptic();
        props.onPress?.(event);
      }}
      style={({ pressed }) => [
        typeof props.style === "function"
          ? props.style({ pressed })
          : props.style,
        { opacity: 1 },
      ]}
    />
  );
};
