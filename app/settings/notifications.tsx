import { router } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { TimePicker } from "@/components/TimePicker";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

function formatTime(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${ampm}`;
}

function timeToDigits(time24: string): { digits: string; ampm: "AM" | "PM" } {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return { digits: `${String(h).padStart(2, "0")}${mStr}`, ampm };
}

function digitsToTime(digits: string, ampm: "AM" | "PM"): string {
  let h: number;
  let m: string;
  if (digits.length === 3) {
    h = parseInt(digits[0], 10);
    m = digits.slice(1);
  } else {
    h = parseInt(digits.slice(0, 2), 10);
    m = digits.slice(2, 4);
  }
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

export default function NotificationsScreen() {
  const { invertColors } = useInvertColors();
  const { tasks, lists } = useReminders();
  const {
    enabled, todaysTasksEnabled, todaysTasksTime, permissionDenied,
    setEnabled, setTodaysTasksEnabled, setTodaysTasksTime,
  } = useNotifications();
  const bg = invertColors ? "white" : "black";

  const initParts = timeToDigits(todaysTasksTime);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeDigits, setTimeDigits] = useState(initParts.digits);
  const [ampm, setAmPm] = useState<"AM" | "PM">(initParts.ampm);

  const handleTimeConfirm = useCallback(() => {
    if (timeDigits.length !== 3 && timeDigits.length !== 4) return;
    const t24 = digitsToTime(timeDigits, ampm);
    setTodaysTasksTime(t24, tasks, lists);
    setShowTimePicker(false);
  }, [timeDigits, ampm, tasks, lists, setTodaysTasksTime]);

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>
        <Header headerTitle="Notifications" />

        {/* Master toggle */}
        <View style={styles.row}>
          <ToggleSwitch
            label="Enable Notifications"
            value={enabled}
            onValueChange={(v) => setEnabled(v, tasks, lists)}
          />
        </View>

        {/* Permission denied message */}
        {permissionDenied && (
          <View style={styles.row}>
            <StyledText style={styles.permissionMsg}>
              Please enable notification permissions for Reminders.
            </StyledText>
          </View>
        )}

        {/* Today's Tasks — only shown if notifications enabled */}
        {enabled && (
          <>
            <View style={styles.row}>
              <ToggleSwitch
                label="Today's Tasks"
                value={todaysTasksEnabled}
                onValueChange={(v) => setTodaysTasksEnabled(v, tasks, lists)}
              />
            </View>

            {/* Time picker row — only shown if Today's Tasks enabled */}
            {todaysTasksEnabled && (
              <HapticPressable
                onPress={() => setShowTimePicker(true)}
                style={styles.row}
              >
                <StyledText style={styles.selectorLabel}>Notification Time</StyledText>
                <StyledText style={styles.selectorValue}>
                  {formatTime(todaysTasksTime)}
                </StyledText>
              </HapticPressable>
            )}
          </>
        )}

        <TimePicker
          visible={showTimePicker}
          digits={timeDigits}
          ampm={ampm}
          onDigit={(d) => setTimeDigits(prev => prev.length < 4 ? prev + d : prev)}
          onBackspace={() => setTimeDigits(prev => prev.slice(0, -1))}
          onAmPm={setAmPm}
          onConfirm={handleTimeConfirm}
          onDismiss={() => setShowTimePicker(false)}
        />
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    paddingHorizontal: n(22),
    paddingVertical: n(16),
  },
  permissionMsg: {
    fontSize: n(16),
    opacity: 0.5,
  },
  selectorLabel: {
    fontSize: n(20),
    paddingTop: n(7.5),
    lineHeight: n(20),
  },
  selectorValue: {
    fontSize: n(30),
    paddingBottom: n(10),
  },
});
