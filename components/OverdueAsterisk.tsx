import Svg, { Path } from "react-native-svg";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

interface OverdueAsteriskProps {
  size?: number;
}

export function OverdueAsterisk({ size = 22 }: OverdueAsteriskProps) {
  const { invertColors } = useInvertColors();
  const color = invertColors ? "black" : "white";
  const dim = n(size);

  return (
    <Svg fill="none" height={dim} viewBox="0 0 39 37" width={dim}>
      <Path
        d="M24.288 20.7L33.856 32.568L27.692 36.984L19.412 24.196L11.224 36.984L5.06 32.384L14.628 20.7L0 16.928L2.392 9.66L16.468 15.18L15.732 0H23.368L22.448 15.18L36.616 9.66L38.916 16.928L24.288 20.7Z"
        fill={color}
      />
    </Svg>
  );
}
