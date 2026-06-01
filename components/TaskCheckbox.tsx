import { StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { HapticPressable } from "@/components/HapticPressable";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

interface TaskCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  paddingBottom?: number;
  paddingTop?: number;
  size?: number;
}

export function TaskCheckbox({
  checked,
  onToggle,
  size = 20,
  paddingTop = 17,
  paddingBottom = 8,
}: TaskCheckboxProps) {
  const { invertColors } = useInvertColors();
  const color = invertColors ? "black" : "white";
  const dim = n(size);

  return (
    <HapticPressable
      onPress={onToggle}
      style={[
        styles.hitArea,
        { paddingTop: n(paddingTop), paddingBottom: n(paddingBottom) },
      ]}
    >
      <Svg fill="none" height={dim} viewBox="0 0 84 84" width={dim}>
        {checked && <Circle cx="42" cy="42" fill={color} r="35.375" />}
        <Path
          d="M42.0068 0.5C64.8971 0.500151 83.5 19.1215 83.5 42.0098C83.5 64.8984 64.8935 83.4998 42.0068 83.5C19.1203 83.5 0.5 64.8987 0.5 42.0098C0.500041 19.1212 19.12 0.5 42.0068 0.5ZM42.0068 6.625C22.4399 6.625 6.62797 22.4411 6.62793 42.0098C6.62793 61.5749 22.4396 77.375 42.0068 77.375C61.5705 77.3749 77.3682 61.5783 77.3682 42.0098C77.3681 22.4433 61.5733 6.62515 42.0068 6.625Z"
          fill={color}
          stroke={color}
        />
      </Svg>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    paddingHorizontal: n(14),
  },
});
