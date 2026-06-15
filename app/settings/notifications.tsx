import { router } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { TimePicker } from "@/components/TimePicker";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { use24HourClock } from "@/hooks/use24HourClock";
import { digitsToTime, formatTime, timeToDisplayParts } from "@/utils/dateTime";
import { n } from "@/utils/scaling";

export default function NotificationsScreen() {
  const { invertColors } = useInvertColors();
  const { tasks, lists } = useReminders();
  const {
    enabled,
    todaysTasksEnabled,
    todaysTasksTime,
    permissionDenied,
    setEnabled,
    setTodaysTasksEnabled,
    setTodaysTasksTime,
  } = useNotifications();
  const bg = invertColors ? "white" : "black";
  const use24Hour = use24HourClock();

  const initParts = timeToDisplayParts(todaysTasksTime, use24Hour);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeDigits, setTimeDigits] = useState(initParts.digits);
  const [ampm, setAmPm] = useState<"AM" | "PM">(initParts.ampm);

  const handleTimeConfirm = useCallback(() => {
    if (timeDigits.length !== 3 && timeDigits.length !== 4) {
      return;
    }
    const t24 = digitsToTime(timeDigits, ampm, use24Hour);
    setTodaysTasksTime(t24, tasks, lists);
    setShowTimePicker(false);
  }, [timeDigits, ampm, tasks, lists, setTodaysTasksTime]);

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header headerTitle="Notifications" />

        {/* Master toggle */}
        <View style={styles.row}>
          <ToggleSwitch
            label="Enable Notifications"
            onValueChange={(v) => setEnabled(v, tasks, lists)}
            value={enabled}
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
                onValueChange={(v) => setTodaysTasksEnabled(v, tasks, lists)}
                value={todaysTasksEnabled}
              />
            </View>

            {/* Time picker row — only shown if Today's Tasks enabled */}
            {todaysTasksEnabled && (
              <HapticPressable
                onPress={() => setShowTimePicker(true)}
                style={styles.row}
              >
                <StyledText style={styles.selectorLabel}>
                  Notification Time
                </StyledText>
                <StyledText style={styles.selectorValue}>
                  {formatTime(todaysTasksTime, use24Hour)}
                </StyledText>
              </HapticPressable>
            )}
          </>
        )}

        <TimePicker
          ampm={ampm}
          digits={timeDigits}
          onAmPm={setAmPm}
          onBackspace={() => setTimeDigits((prev) => prev.slice(0, -1))}
          onConfirm={handleTimeConfirm}
          onDigit={(d) =>
            setTimeDigits((prev) => (prev.length < 4 ? prev + d : prev))
          }
          onDismiss={() => setShowTimePicker(false)}
          use24Hour={use24Hour}
          visible={showTimePicker}
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
