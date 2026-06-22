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
          onPress={() => handleRestore("manual")}
          style={[styles.row, busy && styles.rowDisabled]}
        >
          <StyledText style={styles.rowText}>
            Restore from manual backup
          </StyledText>
        </HapticPressable>

        {autoBackupInfo.exists && (
          <HapticPressable
            onPress={() => handleRestore("auto")}
            style={[styles.row, busy && styles.rowDisabled]}
          >
            <StyledText style={styles.rowText}>
              Restore from auto-backup
            </StyledText>
            {autoBackupInfo.savedAt && (
              <StyledText style={styles.rowSubtext}>
                last saved {formatDate(autoBackupInfo.savedAt.slice(0, 10))}
              </StyledText>
            )}
          </HapticPressable>
        )}
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
  rowText: { fontSize: n(30), paddingBottom: n(4) },
  rowSubtext: { fontSize: n(16), letterSpacing: 0.4, marginTop: n(2) },
});
