import Svg, { Circle, Rect } from "react-native-svg";
import { n } from "@/utils/scaling";

interface ListsIconProps {
  color: string;
  size?: number;
}

export function ListsIcon({ color, size = 48 }: ListsIconProps) {
  // Fixed width of 54px, height maintains aspect ratio
  const width = n(48);
  const height = n(48 * 46 / 90);
  return (
    <Svg width={width} height={height} viewBox="0 0 90 46" fill="none">
      <Circle cx="4" cy="4" r="4" fill={color} />
      <Rect x="16" y="0" width="74" height="8" rx="4" fill={color} />
      <Circle cx="4" cy="23" r="4" fill={color} />
      <Rect x="16" y="19" width="74" height="8" rx="4" fill={color} />
      <Circle cx="4" cy="42" r="4" fill={color} />
      <Rect x="16" y="38" width="74" height="8" rx="4" fill={color} />
    </Svg>
  );
}
