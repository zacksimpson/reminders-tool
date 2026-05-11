import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { type Recurrence } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

const UNITS: Recurrence["unit"][] = ["day", "week", "month", "year"];

interface RecurrencePickerProps {
  visible: boolean;
  value: Recurrence | undefined;
  onSave: (recurrence: Recurrence) => void;
  onDismiss: () => void;
}

export function RecurrencePicker({ visible, value, onSave, onDismiss }: RecurrencePickerProps) {
  const { invertColors } = useInvertColors();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";

  const [interval, setIntervalValue] = useState(value?.interval ?? 1);
  const [unit, setUnit] = useState<Recurrence["unit"]>(value?.unit ?? "day");

  useEffect(() => {
    if (visible) {
      setIntervalValue(value?.interval ?? 1);
      setUnit(value?.unit ?? "day");
    }
  }, [visible, value]);

  const decrement = () => setIntervalValue(i => i <= 1 ? 30 : i - 1);
  const increment = () => setIntervalValue(i => i >= 30 ? 1 : i + 1);
  const cycleUnit = () => {
    const idx = UNITS.indexOf(unit);
    setUnit(UNITS[(idx + 1) % UNITS.length]);
  };

  const unitLabel = interval === 1 ? unit : `${unit}s`;

  return (
    <Modal visible={visible} animationType="none" transparent={false} statusBarTranslucent>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>

        <StyledText style={[styles.title, { color: textColor }]}>Recurs every:</StyledText>

        <View style={styles.pickerRow}>
          <HapticPressable onPress={decrement} style={styles.chevronBtn}>
            <MaterialIcons name="keyboard-arrow-down" size={n(52)} color={textColor} />
          </HapticPressable>
          <StyledText style={[styles.number, { color: textColor }]}>{interval}</StyledText>
          <HapticPressable onPress={increment} style={styles.chevronBtn}>
            <MaterialIcons name="keyboard-arrow-up" size={n(52)} color={textColor} />
          </HapticPressable>
        </View>

        <HapticPressable onPress={cycleUnit} style={styles.unitBtn}>
          <StyledText style={[styles.unit, { color: textColor, borderBottomColor: textColor }]}>
            {unitLabel}
          </StyledText>
        </HapticPressable>

        <View style={styles.footer}>
          <View style={styles.footerSide} />
          <HapticPressable onPress={onDismiss} style={styles.footerBtn}>
            <StyledText style={[styles.dismissX, { color: textColor }]}>✕</StyledText>
          </HapticPressable>
          <View style={styles.footerSide}>
            <HapticPressable onPress={() => onSave({ interval, unit })} style={styles.saveBtn}>
              <StyledText style={[styles.save, { color: textColor }]}>SAVE</StyledText>
            </HapticPressable>
          </View>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    fontSize: n(26),
    textAlign: "center",
    paddingTop: n(60),
    paddingBottom: n(20),
    fontFamily: "PublicSans-Regular",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: n(10),
  },
  chevronBtn: {
    paddingHorizontal: n(32),
    paddingVertical: n(16),
  },
  number: {
    fontSize: n(100),
    fontFamily: "PublicSans-Thin",
    minWidth: n(120),
    textAlign: "center",
  },
  unitBtn: {
    alignSelf: "center",
    paddingVertical: n(8),
    paddingHorizontal: n(16),
  },
  unit: {
    fontSize: n(32),
    fontFamily: "PublicSans-Regular",
    borderBottomWidth: n(1.5),
    paddingBottom: n(2),
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: n(14),
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerSide: { flex: 1, alignItems: "flex-end", paddingRight: n(24) },
  footerBtn: { padding: n(8) },
  saveBtn: { padding: n(8) },
  dismissX: { fontSize: n(28) },
  save: { fontSize: n(24), letterSpacing: n(5), fontFamily: "PublicSans-Regular" },
});
