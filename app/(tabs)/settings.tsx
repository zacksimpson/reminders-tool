import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

const AFTER_QUICK_ADD_LABELS: Record<string, string> = {
  toast: "Add Next",
  "go-to-list": "Go to List",
};

const ADD_POSITION_LABELS: Record<string, string> = {
  top: "Top of List",
  bottom: "Bottom of List",
};

export default function SettingsScreen() {
  const { invertColors, setInvertColors } = useInvertColors();
  const { lists, settings } = useReminders();
  const bg = invertColors ? "white" : "black";

  const defaultList = lists.find((l) => l.id === settings.defaultListId);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: bg }]}
    >
      <Header headerTitle="Settings" hideBackButton />

      <ScrollView overScrollMode="never" showsVerticalScrollIndicator={false}>
        {/* Backup */}
        <HapticPressable
          onPress={() => router.push("/settings/backup")}
          style={styles.row}
        >
          <StyledText style={styles.selectorValue}>Backup</StyledText>
        </HapticPressable>

        {/* Notifications */}
        <HapticPressable
          onPress={() => router.push("/settings/notifications")}
          style={styles.row}
        >
          <StyledText style={styles.selectorValue}>Notifications</StyledText>
        </HapticPressable>

        {/* Today View */}
        <HapticPressable
          onPress={() => router.push("/settings/today-view")}
          style={styles.row}
        >
          <StyledText style={styles.selectorValue}>Today View</StyledText>
        </HapticPressable>

        {/* Default List */}
        <HapticPressable
          onPress={() => router.push("/settings/default-list")}
          style={styles.row}
        >
          <StyledText style={styles.selectorLabel}>Default List</StyledText>
          <StyledText style={styles.selectorValue}>
            {defaultList?.title ?? "Inbox"}
          </StyledText>
        </HapticPressable>

        {/* After Quick Add */}
        <HapticPressable
          onPress={() => router.push("/settings/after-quick-add")}
          style={styles.row}
        >
          <StyledText style={styles.selectorLabel}>After Quick Add</StyledText>
          <StyledText style={styles.selectorValue}>
            {AFTER_QUICK_ADD_LABELS[settings.afterAddBehavior] ?? "Add Next"}
          </StyledText>
        </HapticPressable>

        {/* Add New Tasks */}
        <HapticPressable
          onPress={() => router.push("/settings/add-position")}
          style={styles.row}
        >
          <StyledText style={styles.selectorLabel}>Add New Tasks</StyledText>
          <StyledText style={styles.selectorValue}>
            {ADD_POSITION_LABELS[settings.addPosition ?? "bottom"] ??
              "Bottom of List"}
          </StyledText>
        </HapticPressable>

        {/* Invert Colors */}
        <View style={styles.row}>
          <ToggleSwitch
            label="Invert Colors"
            onValueChange={setInvertColors}
            value={invertColors}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    paddingHorizontal: n(22),
    paddingVertical: n(16),
    flexDirection: "column",
    alignItems: "flex-start",
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
