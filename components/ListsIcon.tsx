import Svg, { Circle, Rect } from "react-native-svg";
import { n } from "@/utils/scaling";

interface ListsIconProps {
  color: string;
}

export function ListsIcon({ color }: ListsIconProps) {
  // Fixed width of 54px, height maintains aspect ratio
  const width = n(48);
  const height = n((48 * 46) / 90);
  return (
    <Svg fill="none" height={height} viewBox="0 0 90 46" width={width}>
      <Circle cx="4" cy="4" fill={color} r="4" />
      <Rect fill={color} height="8" rx="4" width="74" x="16" y="0" />
      <Circle cx="4" cy="23" fill={color} r="4" />
      <Rect fill={color} height="8" rx="4" width="74" x="16" y="19" />
      <Circle cx="4" cy="42" fill={color} r="4" />
      <Rect fill={color} height="8" rx="4" width="74" x="16" y="38" />
    </Svg>
  );
}
