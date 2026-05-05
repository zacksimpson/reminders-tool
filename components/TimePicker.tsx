import { MaterialIcons } from "@expo/vector-icons";
import { Modal, StyleSheet, View } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyledText } from "@/components/StyledText";
import { Header } from "@/components/Header";
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
      // If first digit is 0, second digit is the hour (1-9)
      if (proposed[0] === "0") return parseInt(next, 10) >= 1 && parseInt(next, 10) <= 9;
      // Otherwise second digit is always minutes-tens (0-5)
      return parseInt(next, 10) <= 5;

    case 3: {
      const firstDigit = parseInt(proposed[0], 10);
      // Leading zero case: "014" → on way to "0145" = 01:45
      // d[0]=0 (leading zero), d[1]=hour-ones (1-9), d[2]=minutes-tens (0-5)
      if (firstDigit === 0) {
        const hourOnes = parseInt(proposed[1], 10);
        const minTens = parseInt(proposed[2], 10);
        return hourOnes >= 1 && hourOnes <= 9 && minTens >= 0 && minTens <= 5;
      }
      // Normal H:MM case: first digit is hour (1-9), last two are minutes
      const m = parseInt(proposed.slice(1), 10);
      return firstDigit >= 1 && firstDigit <= 9 && m >= 0 && m <= 59;
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
        <Header hideBackButton />

        {/* AM/PM + time display */}
        <View style={styles.topSection}>
          {/* AM/PM pinned to left/right edges */}
          <HapticPressable onPress={() => onAmPm("AM")} style={styles.ampmLeft}>
            <StyledText style={styles.ampmText}>AM</StyledText>
            {ampm === "AM" && <View style={[styles.ampmUnderline, { backgroundColor: textColor }]} />}
          </HapticPressable>

          {/* Time display centered absolutely so it never affects AM/PM position */}
          <View style={styles.timeContainer} pointerEvents="none">
            <StyledText style={styles.timeDisplay}>{buildDisplay(digits)}</StyledText>
          </View>

          <HapticPressable onPress={() => onAmPm("PM")} style={styles.ampmRight}>
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
  container: { flex: 1, paddingHorizontal: n(56) },
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: n(32),
    paddingBottom: n(8),
    position: "relative",
  },
  ampmLeft: { alignItems: "center", width: n(60), paddingLeft: n(8) },
  ampmRight: { alignItems: "center", width: n(60), paddingRight: n(8) },
  timeContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  ampmText: { fontSize: n(24) },
  ampmUnderline: { height: n(3), width: n(32), marginTop: n(2) },
  timeDisplay: {
    fontSize: n(90),
    fontFamily: "PublicSans-Thin",
    textAlign: "center",
    includeFontPadding: false,
  },
  numpad: { flex: 1, justifyContent: "space-evenly", paddingBottom: n(16) },
  numRow: { flexDirection: "row", justifyContent: "space-between" },
  numBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: n(3) },
  numText: { fontSize: n(35), fontFamily: "PublicSans-Regular" },
  saveText: { fontSize: n(20), fontFamily: "PublicSans-Regular" },
  dismissX: { fontSize: n(24) },
});
