import { MaterialIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Modal, StyleSheet, Text as DefaultText, View } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DatePickerProps {
  visible: boolean;
  value?: string;
  onSelect: (date: string) => void;
  onDismiss: () => void;
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function DatePicker({
  visible, value, onSelect, onDismiss,
  viewYear, viewMonth, onPrevMonth, onNextMonth,
}: DatePickerProps) {
  const { invertColors } = useInvertColors();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";

  const { rows } = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7).concat(Array(7).fill(null)).slice(0, 7));
    }
    return { rows };
  }, [viewYear, viewMonth]);

  const handleDayPress = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onSelect(dateStr);
  };

  return (
    <Modal visible={visible} animationType="none" transparent={false} statusBarTranslucent>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>

        {/* Month/year header */}
        <View style={styles.header}>
          <HapticPressable onPress={onPrevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name="chevron-left" size={n(36)} color={textColor} />
          </HapticPressable>
          <StyledText style={styles.monthTitle}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </StyledText>
          <HapticPressable onPress={onNextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name="chevron-right" size={n(36)} color={textColor} />
          </HapticPressable>
        </View>

        {/* Day headers */}
        <View style={styles.dayHeaderRow}>
          {DAY_HEADERS.map((d, i) => (
            <View key={`h-${i}`} style={styles.dayHeaderCell}>
              <DefaultText
                allowFontScaling={false}
                style={[styles.dayHeader, { color: textColor }]}
              >
                {d}
              </DefaultText>
            </View>
          ))}
        </View>

        {/* Calendar grid — does NOT flex, so × stays anchored */}
        <View style={styles.grid}>
          {rows.map((row, ri) => (
            <View key={`row-${ri}`} style={styles.row}>
              {row.map((day, ci) => {
                if (!day) return <View key={`e-${ci}`} style={styles.cell} />;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const isSelected = dateStr === value;
                return (
                  <HapticPressable
                    key={`d-${day}`}
                    onPress={() => handleDayPress(day)}
                    style={styles.cell}
                  >
                    <StyledText style={[styles.dayText, isSelected && styles.daySelected]}>
                      {day}
                    </StyledText>
                    {isSelected && (
                      <View style={[styles.todayUnderline, { backgroundColor: textColor }]} />
                    )}
                  </HapticPressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* × anchored to bottom — absolutely positioned so it never moves */}
        <View style={styles.footer}>
          <HapticPressable
            onPress={onDismiss}
            hitSlop={{ top: 20, bottom: 20, left: 40, right: 40 }}
          >
            <StyledText style={styles.dismissX}>✕</StyledText>
          </HapticPressable>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: n(16),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: n(10),
    paddingBottom: n(16),
    paddingHorizontal: n(4),
  },
  monthTitle: {
    fontSize: n(22),
  },
  dayHeaderRow: {
    flexDirection: "row",
    marginBottom: n(4),
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: n(8),
  },
  dayHeader: {
    fontSize: n(16),
    textAlign: "center",
    fontFamily: "PublicSans-Regular",
    color: "white",
  },
  grid: {
    // No flex — fixed height based on content so footer stays anchored
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: n(13),
    position: "relative",
  },
  dayText: {
    fontSize: n(22),
    textAlign: "center",
    fontFamily: "PublicSans-Regular",
  },
  daySelected: {},
  todayUnderline: {
    position: "absolute",
    bottom: n(7),
    width: n(14),
    height: n(1.5),
  },
  footer: {
    position: "absolute",
    bottom: n(48),
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dismissX: {
    fontSize: n(28),
  },
});
