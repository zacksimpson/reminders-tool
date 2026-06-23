import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { Toast } from "@/components/Toast";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import {
  type AutoBackupInfo,
  exportBackup,
  getAutoBackupInfo,
  importAutoBackup,
  importBackup,
  type RestoredData,
} from "@/utils/backup";
import { formatDate } from "@/utils/dateTime";
import { n } from "@/utils/scaling";

export default function BackupScreen() {
  const { invertColors } = useInvertColors();
  const { lists, tasks, settings, restoreBackup } = useReminders();
  const { confirmed } = useLocalSearchParams<{ confirmed?: string }>();
  const bg = invertColors ? "white" : "black";
  const [busy, setBusy] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [pendingData, setPendingData] = useState<RestoredData | null>(null);
  const [autoBackupInfo, setAutoBackupInfo] = useState<AutoBackupInfo>({
    exists: false,
    savedAt: null,
  });

  useEffect(() => {
    getAutoBackupInfo()
      .then(setAutoBackupInfo)
      .catch(() => {
        /* auto-backup info is optional — ignore errors */
      });
  }, []);

  // Called when the confirm screen dismisses back here with confirmed=true
  useEffect(() => {
    if (confirmed !== "true" || !pendingData) {
      return;
    }
    router.setParams({ confirmed: undefined });
    const doRestore = async () => {
      setBusy(true);
      try {
        await restoreBackup(pendingData);
        setPendingData(null);
        setToastVisible(true);
      } catch {
        Alert.alert(
          "Restore failed",
          "Something went wrong. Please try again."
        );
        setBusy(false);
      }
    };
    doRestore();
  }, [confirmed, pendingData, restoreBackup]);

  async function handleExport() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await exportBackup(lists, tasks, settings);
    } catch {
      Alert.alert("Export failed", "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(source: "manual" | "auto") {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const data =
        source === "auto" ? await importAutoBackup() : await importBackup();
      if (!data) {
        setBusy(false);
        return;
      }
      setPendingData(data);
      setBusy(false);
      router.push({
        pathname: "/confirm",
        params: {
          message:
            "Reminders from the backup that aren't already in your app will be added. Nothing will be removed or overwritten.",
          confirmText: "Restore",
          action: "restore",
          returnPath: "/settings/backup",
        },
      });
    } catch {
      setBusy(false);
      router.push({
        pathname: "/confirm",
        params: {
          message: "The selected file is not a valid Reminders backup.",
          confirmText: "Understood",
          action: "invalid-file",
          returnPath: "/settings/backup",
        },
      });
    }
  }

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header headerTitle="Backup & Restore" />

        <HapticPressable
          onPress={handleExport}
          style={[styles.row, busy && styles.rowDisabled]}
        >
          <StyledText style={styles.rowText}>Export Backup</StyledText>
          <StyledText style={styles.rowSubtext}>
            manually save a backup file
          </StyledText>
        </HapticPressable>

        {autoBackupInfo.exists && (
          <HapticPressable
            onPress={() => handleRestore("auto")}
            style={[styles.row, busy && styles.rowDisabled]}
          >
            <StyledText style={styles.rowText}>Restore Auto Backup</StyledText>
            {autoBackupInfo.savedAt && (
              <StyledText style={styles.rowSubtext}>
                auto-saved {formatDate(autoBackupInfo.savedAt.slice(0, 10))}
              </StyledText>
            )}
          </HapticPressable>
        )}

        <HapticPressable
          onPress={() => handleRestore("manual")}
          style={[styles.row, busy && styles.rowDisabled]}
        >
          <StyledText style={styles.rowText}>Import From File</StyledText>
          <StyledText style={styles.rowSubtext}>
            use a file you manually exported
          </StyledText>
        </HapticPressable>
      </SafeAreaView>

      <Toast
        message="imported"
        onHide={() => {
          setToastVisible(false);
          router.back();
        }}
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
  rowText: { fontSize: n(30) },
  rowSubtext: { fontSize: n(17), letterSpacing: 0.5, marginTop: n(2) },
});
