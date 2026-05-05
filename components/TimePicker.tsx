import { MaterialIcons } from "@expo/vector-icons";
import { Modal, StyleSheet, View } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

// ─── Digit validation ─────────────────────────────────────────────────────────
// Display slots (right-to-left fill):
// 1 digit  "6"    →  "  : 6"
// 2 digits "63"   →  "  :63"   ← 6 is future hour, 3 is future minutes-tens
// 3 digits "630"  →  "6:30"
// 4 digits "1230" →  "12:30"
//
// Validation rules per position:
// Position 1 (d[0]): could be minutes-ones (0-9) or future hour — always allow
// Position 2 (d[1]): this will ALWAYS become the minutes-tens digit
//                    (either in a 3-digit time as d[0]:d[1]d[2],
//                     or in a 4-digit time as d[0]d[1]:d[2]d[3])
//                    Minutes tens must be 0-5.
// Position 3 (d[2]): minutes-ones in 3-digit time → 0-9, always valid
//                    BUT also check full 3-digit time is valid: h=d[0], m=d[1]d[2]
// Position 4 (d[3]): check full 4-digit time: h=d[0]d[1], m=d[2]d[3]

function isValidNextDigit(current: string, next: string): boolean {
  const proposed = current + next;

  switch (proposed.length) {
    case 1:
      // Always allow — any digit can start a valid time
      return true;

    case 2:
      // d[1] will always be the minutes-TENS digit regardless of
      // whether we end up with 3 or 4 digits total.
      // Minutes tens must be 0-5.
      return parseInt(next, 10) <= 5;

    case 3: {
      // 3-digit time: H:MM
      const h = parseInt(proposed[0], 10);
      const m = parseInt(proposed.slice(1), 10);
      return h >= 1 && h <= 9 && m >= 0 && m <= 59;
    }

    case 4: {
      // 4-digit time: HH:MM
      const h = parseInt(proposed.slice(0, 2), 10);
      const m = parseInt(proposed.slice(2), 10);
      return h >= 1 && h <= 12 && m >= 0 && m <= 59;
    }

    default:
      return false;
  }
}

// ─── Display builder ──────────────────────────────────────────────────────────
function buildDisplay(digits: string): string {
  switch (digits.length) {
    case 0: return "  :  ";
    case 1: return `  : ${digits[0]}`;
    case 2: return `  :${digits}`;
    case 3: return `${digits[0]}:${digits.slice(1)}`;
    case 4: return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    default: return "  :  ";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TimePickerProps {
  visible: boolean;
  digits: string;
  ampm: "AM" | "PM";
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onAmPm: (v: "AM" | "PM") => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function TimePicker({
  visible, digits, ampm,
  onDigit, onBackspace, onAmPm, onConfirm, onDismiss,
}: TimePickerProps) {
  const { invertColors } = useInvertColors();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const hasDigits = digits.length > 0;
  const canConfirm = digits.length === 3 || digits.length === 4;

  const handleDigit = (d: string) => {
    if (digits.length >= 4) return;
    if (isValidNextDigit(digits, d)) onDigit(d);
  };

  const numRows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]];

  return (
    <Modal visible={visible} animationType="none" transparent={false} statusBarTranslucent>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>

        {/* AM/PM + time display */}
        <View style={styles.topSection}>
          <HapticPressable onPress={() => onAmPm("AM")} style={styles.ampmBtn}>
            <StyledText style={styles.ampmText}>AM</StyledText>
            {ampm === "AM" && <View style={[styles.ampmUnderline, { backgroundColor: textColor }]} />}
          </HapticPressable>

          <StyledText style={styles.timeDisplay}>
            {buildDisplay(digits)}
          </StyledText>

          <HapticPressable onPress={() => onAmPm("PM")} style={styles.ampmBtn}>
            <StyledText style={styles.ampmText}>PM</StyledText>
            {ampm === "PM" && <View style={[styles.ampmUnderline, { backgroundColor: textColor }]} />}
          </HapticPressable>
        </View>

        {/* Numpad */}
        <View style={styles.numpad}>
          {numRows.map((row, ri) => (
            <View key={`row-${ri}`} style={styles.numRow}>
              {row.map((d) => (
                <HapticPressable
                  key={d}
                  onPress={() => handleDigit(d)}
                  style={styles.numBtn}
                >
                  <StyledText style={styles.numText}>{d}</StyledText>
                </HapticPressable>
              ))}
            </View>
          ))}

          {/* Bottom row */}
          <View style={styles.numRow}>
            {canConfirm ? (
              <HapticPressable onPress={onConfirm} style={styles.numBtn}>
                <StyledText style={styles.saveText}>SAVE</StyledText>
              </HapticPressable>
            ) : !hasDigits ? (
              <HapticPressable onPress={onDismiss} style={styles.numBtn}>
                <StyledText style={styles.dismissX}>✕</StyledText>
              </HapticPressable>
            ) : (
              <View style={styles.numBtn} />
            )}

            <HapticPressable onPress={() => handleDigit("0")} style={styles.numBtn}>
              <StyledText style={styles.numText}>0</StyledText>
            </HapticPressable>

            {hasDigits ? (
              <HapticPressable onPress={onBackspace} style={styles.numBtn}>
                <MaterialIcons name="chevron-left" size={n(44)} color={textColor} />
              </HapticPressable>
            ) : (
              <View style={styles.numBtn} />
            )}
          </View>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: n(16) },
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: n(24),
    paddingBottom: n(24),
    paddingHorizontal: n(8),
  },
  ampmBtn: { alignItems: "center", minWidth: n(52) },
  ampmText: { fontSize: n(20) },
  ampmUnderline: { height: n(1.5), width: "100%", marginTop: n(3) },
  timeDisplay: {
    fontSize: n(72),
    fontWeight: "200",
    fontFamily: "PublicSans-Regular",
    textAlign: "center",
    includeFontPadding: false,
  },
  numpad: { flex: 1, justifyContent: "space-evenly", paddingBottom: n(16) },
  numRow: { flexDirection: "row", justifyContent: "space-between" },
  numBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: n(12) },
  numText: { fontSize: n(36), fontFamily: "PublicSans-Regular" },
  saveText: { fontSize: n(20), fontFamily: "PublicSans-Regular" },
  dismissX: { fontSize: n(24) },
});
