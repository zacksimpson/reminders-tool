import Svg, { Circle, Line, Path } from "react-native-svg";
import { n } from "@/utils/scaling";

interface AddIconProps {
  color: string;
  size?: number;
}

export function AddIcon({ color, size = n(48) }: AddIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 83 83" fill="none">
      <Circle cx="41.5" cy="41.5" r="39" stroke={color} strokeWidth="5" />
      <Line x1="41.5" y1="17" x2="41.5" y2="67" stroke={color} strokeWidth="5" />
      <Path d="M67 41.5L17 41.5" stroke={color} strokeWidth="5" />
    </Svg>
  );
}
