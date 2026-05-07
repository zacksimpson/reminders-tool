import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

export default function TodayViewScreen() {
  const { invertColors } = useInvertColors();
  const { settings, updateSettings } = useReminders();
  const bg = invertColors ? "white" : "black";

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>
        <Header headerTitle="Today View" />
        <View style={styles.row}>
          <ToggleSwitch
            label="Show Overdue"
            value={settings.showOverdue ?? true}
            onValueChange={(v) => updateSettings({ showOverdue: v })}
          />
        </View>
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { paddingHorizontal: n(22), paddingVertical: n(16) },
});
