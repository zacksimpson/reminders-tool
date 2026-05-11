import Svg, { Path } from "react-native-svg";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

interface DeleteIconProps {
  size?: number;
}

export function DeleteIcon({ size = n(15) }: DeleteIconProps) {
  const { invertColors } = useInvertColors();
  const color = invertColors ? "black" : "white";

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.5859 13.3828L3.46875 1.26562L1.26562 3.46875L13.3828 15.5859L1.26562 27.7031L3.46875 29.9063L15.5859 17.7891L27.7031 29.9063L29.9063 27.7031L17.7891 15.5859L29.9063 3.46875L27.7031 1.26562L15.5859 13.3828Z"
        fill={color}
      />
      <Path
        d="M5.30854e-08 3.46908L12.1169 15.5859L5.30854e-08 27.7028L3.46908 31.1719L15.5859 19.055L27.7028 31.1719L31.1719 27.7028L19.055 15.5859L31.1719 3.46908L27.7028 0L15.5859 12.1169L3.46908 0L5.30854e-08 3.46908ZM15.5859 13.3825L27.7028 1.26561L29.9063 3.46908L17.7894 15.5859L29.9063 27.7028L27.7028 29.9063L15.5859 17.7894L3.46908 29.9063L1.26561 27.7028L13.3825 15.5859L1.26561 3.46908L3.46908 1.26561L15.5859 13.3825Z"
        fill={color}
      />
    </Svg>
  );
}
