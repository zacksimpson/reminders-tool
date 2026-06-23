import { MaterialIcons } from "@expo/vector-icons";
import { Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
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
// Position 2 (d[1]): usually minutes-tens (0-5), except in 24h mode where d[0]="1"
//                    allows d[1]=6-9 (hours 16-19) on the way to a 4-digit time
// Position 3 (d[2]): check full 3-digit time h=d[0], m=d[1]d[2]; in 24h mode
//                    also allow as 4-digit prefix where h=d[0]d[1], minTens=d[2]
// Position 4 (d[3]): check full 4-digit time: h=d[0]d[1], m=d[2]d[3]

function isValid2Digits(proposed: string, use24Hour: boolean): boolean {
  const b = Number.parseInt(proposed[1], 10);
  if (proposed[0] === "0") {
    // 24h: 00–09 all valid; 12h: 01–09
    return b >= (use24Hour ? 0 : 1) && b <= 9;
  }
  // In 24h mode, "1" followed by 6–9 is valid (hours 16–19)
  if (use24Hour && proposed[0] === "1") {
    return b <= 9;
  }
  // Otherwise second digit is minutes-tens (0–5)
  return b <= 5;
}

function isValid3Digits(proposed: string, use24Hour: boolean): boolean {
  const firstDigit = Number.parseInt(proposed[0], 10);
  // Leading zero case: "0yz" → on way to "0yzw" = 0y:zw
  if (firstDigit === 0) {
    const hourOnes = Number.parseInt(proposed[1], 10);
    const minTens = Number.parseInt(proposed[2], 10);
    const minHourOnes = use24Hour ? 0 : 1;
    return (
      hourOnes >= minHourOnes && hourOnes <= 9 && minTens >= 0 && minTens <= 5
    );
  }
  // In 24h mode, "1x" where x is 6–9 means we're building a 4-digit time
  // (e.g. "160" → "1600" = 16:00). Validate as HH:M_ prefix.
  if (use24Hour) {
    const h = Number.parseInt(proposed.slice(0, 2), 10);
    const minTens = Number.parseInt(proposed[2], 10);
    if (h >= 10 && h <= 23 && minTens >= 0 && minTens <= 5) {
      return true;
    }
  }
  // Normal H:MM case: first digit is hour (1–9), last two are minutes
  const m = Number.parseInt(proposed.slice(1), 10);
  return firstDigit >= 1 && firstDigit <= 9 && m >= 0 && m <= 59;
}

function isValid4Digits(proposed: string, use24Hour: boolean): boolean {
  const h = Number.parseInt(proposed.slice(0, 2), 10);
  const m = Number.parseInt(proposed.slice(2), 10);
  const maxH = use24Hour ? 23 : 12;
  const minH = use24Hour ? 0 : 1;
  return h >= minH && h <= maxH && m >= 0 && m <= 59;
}

function isValidNextDigit(
  current: string,
  next: string,
  use24Hour: boolean
): boolean {
  const proposed = current + next;
  switch (proposed.length) {
    case 1:
      return true;
    case 2:
      return isValid2Digits(proposed, use24Hour);
    case 3:
      return isValid3Digits(proposed, use24Hour);
    case 4:
      return isValid4Digits(proposed, use24Hour);
    default:
      return false;
  }
}

// ─── Display builder ──────────────────────────────────────────────────────────
function buildDisplay(digits: string): string {
  switch (digits.length) {
    case 0:
      return "  :  ";
    case 1:
      return `  : ${digits[0]}`;
    case 2:
      return `  :${digits}`;
    case 3:
      return `${digits[0]}:${digits.slice(1)}`;
    case 4:
      return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    default:
      return "  :  ";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TimePickerProps {
  ampm: "AM" | "PM";
  digits: string;
  onAmPm: (v: "AM" | "PM") => void;
  onBackspace: () => void;
  onConfirm: () => void;
  onDigit: (d: string) => void;
  onDismiss: () => void;
  use24Hour?: boolean;
  visible: boolean;
}

export function TimePicker({
  visible,
  digits,
  ampm,
  onDigit,
  onBackspace,
  onAmPm,
  onConfirm,
  onDismiss,
  use24Hour = false,
}: TimePickerProps) {
  const { invertColors } = useInvertColors();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const hasDigits = digits.length > 0;
  const canConfirm = digits.length === 3 || digits.length === 4;

  let saveOrDismissBtn: React.ReactNode;
  if (canConfirm) {
    saveOrDismissBtn = (
      <HapticPressable onPress={onConfirm} style={styles.numBtn}>
        <StyledText style={styles.saveText}>SAVE</StyledText>
      </HapticPressable>
    );
  } else if (hasDigits) {
    saveOrDismissBtn = <View style={styles.numBtn} />;
  } else {
    saveOrDismissBtn = (
      <HapticPressable onPress={onDismiss} style={styles.numBtn}>
        <StyledText style={styles.dismissX}>✕</StyledText>
      </HapticPressable>
    );
  }

  const handleDigit = (d: string) => {
    if (digits.length >= 4) {
      return;
    }
    if (isValidNextDigit(digits, d, use24Hour)) {
      onDigit(d);
    }
  };

  const numRows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];

  const renderAmPm = (value: "AM" | "PM") => {
    const sideStyle = value === "AM" ? styles.ampmLeft : styles.ampmRight;
    if (use24Hour) {
      return <View style={[sideStyle, styles.ampmSpacer]} />;
    }
    return (
      <HapticPressable onPress={() => onAmPm(value)} style={sideStyle}>
        <StyledText style={styles.ampmText}>{value}</StyledText>
        {ampm === value && (
          <View
            style={[styles.ampmUnderline, { backgroundColor: textColor }]}
          />
        )}
      </HapticPressable>
    );
  };

  return (
    <Modal
      animationType="none"
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <Header hideBackButton />

        {/* AM/PM + time display */}
        <View style={styles.topSection}>
          {renderAmPm("AM")}

          {/* Time display centered absolutely so it never affects AM/PM position */}
          <View pointerEvents="none" style={styles.timeContainer}>
            <StyledText style={styles.timeDisplay}>
              {buildDisplay(digits)}
            </StyledText>
          </View>

          {renderAmPm("PM")}
        </View>

        {/* Numpad */}
        <View style={styles.numpad}>
          {numRows.map((row, ri) => {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static numpad rows, index is correct key
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
            );
          })}

          {/* Bottom row */}
          <View style={styles.numRow}>
            {saveOrDismissBtn}

            <HapticPressable
              onPress={() => handleDigit("0")}
              style={styles.numBtn}
            >
              <StyledText style={styles.numText}>0</StyledText>
            </HapticPressable>

            {hasDigits ? (
              <HapticPressable onPress={onBackspace} style={styles.numBtn}>
                <MaterialIcons
                  color={textColor}
                  name="chevron-left"
                  size={n(44)}
                />
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
    marginHorizontal: n(-32),
  },
  ampmSpacer: {
    height: n(34),
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
  numBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: n(3),
  },
  numText: { fontSize: n(35), fontFamily: "PublicSans-Regular" },
  saveText: { fontSize: n(20), fontFamily: "PublicSans-Regular" },
  dismissX: { fontSize: n(24) },
});
