import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { Toast } from "@/components/Toast";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { exportBackup, importBackup } from "@/utils/backup";
import { n } from "@/utils/scaling";

export default function BackupScreen() {
  const { invertColors } = useInvertColors();
  const { lists, tasks, settings, restoreBackup } = useReminders();
  const bg = invertColors ? "white" : "black";
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const goBackOnToastClose = useRef(false);

  function showToast(message: string, goBack = false) {
    goBackOnToastClose.current = goBack;
    setToastMessage(message);
    setToastVisible(true);
  }

  function handleToastHide() {
    setToastVisible(false);
    if (goBackOnToastClose.current) {
      router.back();
    }
  }

  async function handleExport() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await exportBackup(lists, tasks, settings);
      showToast("exported");
    } catch {
      Alert.alert("Export failed", "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const data = await importBackup();
      if (!data) {
        setBusy(false);
        return;
      }
      Alert.alert(
        "Restore backup?",
        "Reminders from the backup that aren't already in your app will be added. Nothing will be removed or overwritten.",
        [
          { text: "Cancel", style: "cancel", onPress: () => setBusy(false) },
          {
            text: "Restore",
            onPress: async () => {
              try {
                await restoreBackup(data);
                showToast("imported", true);
              } catch {
                Alert.alert(
                  "Restore failed",
                  "Something went wrong. Please try again."
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert(
        "Invalid file",
        "The selected file is not a valid Reminders backup."
      );
      setBusy(false);
    }
  }

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header headerTitle="Backup" />

        <HapticPressable
          onPress={handleExport}
          style={[styles.row, busy && styles.rowDisabled]}
        >
          <StyledText style={styles.rowText}>Export backup</StyledText>
        </HapticPressable>

        <HapticPressable
          onPress={handleRestore}
          style={[styles.row, busy && styles.rowDisabled]}
        >
          <StyledText style={styles.rowText}>Restore from backup</StyledText>
        </HapticPressable>
      </SafeAreaView>

      <Toast
        message={toastMessage}
        onHide={handleToastHide}
        visible={toastVisible}
      />
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    paddingHorizontal: n(22),
    paddingVertical: n(16),
  },
  rowDisabled: { opacity: 0.4 },
  rowText: { fontSize: n(30), paddingBottom: n(10) },
});
