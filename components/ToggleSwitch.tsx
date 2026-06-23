import { StyleSheet, View } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

const CIRCLE_DIAMETER = n(9.8);
const CIRCLE_BORDER = n(2.5);
const LINE_WIDTH = n(14.5);
const LINE_HEIGHT = n(2.22);

const graphicStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  circle: {
    width: CIRCLE_DIAMETER,
    height: CIRCLE_DIAMETER,
    borderRadius: CIRCLE_DIAMETER / 2,
  },
  hollowCircle: {
    width: CIRCLE_DIAMETER,
    height: CIRCLE_DIAMETER,
    borderRadius: CIRCLE_DIAMETER / 2,
    borderWidth: CIRCLE_BORDER,
  },
  line: {
    width: LINE_WIDTH,
    height: LINE_HEIGHT,
  },
});

const ToggleSwitchGraphic = ({ value }: { value: boolean }) => {
  const { invertColors } = useInvertColors();
  const switchColor = invertColors ? "black" : "white";

  return (
    <View style={graphicStyles.container}>
      {value ? (
        <>
          <View
            style={[graphicStyles.line, { backgroundColor: switchColor }]}
          />
          <View
            style={[graphicStyles.circle, { backgroundColor: switchColor }]}
          />
        </>
      ) : (
        <>
          <View
            style={[graphicStyles.hollowCircle, { borderColor: switchColor }]}
          />
          <View
            style={[graphicStyles.line, { backgroundColor: switchColor }]}
          />
        </>
      )}
    </View>
  );
};

interface ToggleSwitchProps {
  description?: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}

export function ToggleSwitch({
  description,
  label,
  value,
  onValueChange,
}: ToggleSwitchProps) {
  return (
    <HapticPressable
      onPress={() => onValueChange(!value)}
      style={[styles.container, description ? styles.containerTop : null]}
    >
      <View
        style={[
          styles.switchTouchable,
          description ? styles.switchTouchableTop : null,
        ]}
      >
        <ToggleSwitchGraphic value={value} />
      </View>
      <View style={styles.textTouchable}>
        <StyledText style={styles.label}>{label}</StyledText>
        {description && (
          <StyledText style={styles.description}>{description}</StyledText>
        )}
      </View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: n(9),
  },
  containerTop: {
    alignItems: "flex-start",
  },
  switchTouchable: {
    marginTop: n(6),
    marginRight: n(20),
    marginLeft: n(8.5),
  },
  switchTouchableTop: {
    marginTop: n(17),
  },
  textTouchable: {
    flex: 1,
  },
  label: {
    fontSize: n(30),
  },
  description: {
    fontSize: n(17),
    letterSpacing: 0.5,
    marginTop: n(2),
  },
});
