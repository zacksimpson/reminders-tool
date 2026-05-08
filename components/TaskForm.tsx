import { useCallback, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { DatePicker } from "@/components/DatePicker";
import { Header } from "@/components/Header";
import { HapticPressable } from "@/components/HapticPressable";
import { ListPickerModal } from "@/components/ListPickerModal";
import { StyledText } from "@/components/StyledText";
import { TimePicker } from "@/components/TimePicker";
import { Toast } from "@/components/Toast";
import { router } from "expo-router";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { triggerHaptic } from "@/utils/haptics";
import { useScrollIndicator } from "@/hooks/useScrollIndicator";
import { useReminders } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[mo - 1]} ${d}, ${y}`;
}

function formatDisplayTime(digits: string, ampm: "AM" | "PM"): string {
  const h = digits.length === 3
    ? parseInt(digits[0], 10)
    : parseInt(digits.slice(0, 2), 10);
  const m = digits.length === 3 ? digits.slice(1) : digits.slice(2, 4);
  return `${h}:${m} ${ampm}`;
}

export function digitsToTime(digits: string, ampm: "AM" | "PM"): string {
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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TaskFormProps {
  defaultListId?: string;
  defaultDate?: string; // "YYYY-MM-DD"
  onSaved: () => void; // called after task is saved (and toast dismissed if shown)
  onBack?: () => void; // override back button behavior (e.g. when used inside a Modal)
  isModal?: boolean; // when true, hides header back/check and shows bottom × / SAVE footer
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskForm({ defaultListId, defaultDate, onSaved, onBack, isModal }: TaskFormProps) {
  const { invertColors } = useInvertColors();
  const { lists, settings, addTask } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#AAAAAA" : "#555555";

  const resolvedListId = defaultListId ?? settings.defaultListId;
  const { handleScroll, scrollIndicatorHeight, scrollIndicatorPosition, setContentHeight, setScrollViewHeight } = useScrollIndicator();

  const [title, setTitle] = useState("");
  const [selectedListId, setSelectedListId] = useState(resolvedListId);
  const [date, setDate] = useState<string | undefined>(defaultDate);
  const [confirmedTime, setConfirmedTime] = useState<string | undefined>();
  const [timeDigits, setTimeDigits] = useState("");
  const [ampm, setAmPm] = useState<"AM" | "PM">("AM");

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; completed: boolean }>>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const selectedList = lists.find(l => l.id === selectedListId) ?? lists[0];
  const canSave = title.trim().length > 0;

  const resetForm = useCallback((keepList = false) => {
    setTitle("");
    if (!keepList) setSelectedListId(resolvedListId);
    setDate(defaultDate);
    setConfirmedTime(undefined);
    setTimeDigits("");
    setAmPm("AM");
    setSubtasks([]);
    setNewSubtask("");
  }, [resolvedListId, defaultDate]);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    Keyboard.dismiss();
    addTask({
      title: title.trim(),
      listId: selectedListId,
      date,
      time: confirmedTime,
      subtasks: subtasks.map(s => ({
        id: s.id,
        title: s.title,
        completed: s.completed,
        createdAt: Date.now(),
      })),
    });

    if (settings.afterAddBehavior === "toast") {
      setToastVisible(true);
    } else {
      const listId = selectedListId;
      resetForm(false);
      onSaved();
      router.navigate("/(tabs)/");
      router.push({ pathname: "/list/[id]", params: { id: listId } });
    }
  }, [canSave, title, selectedListId, date, confirmedTime, subtasks, settings, addTask, resetForm, onSaved]);

  const handleTimeConfirm = useCallback(() => {
    if (timeDigits.length !== 3 && timeDigits.length !== 4) return;
    setConfirmedTime(digitsToTime(timeDigits, ampm));
    setShowTimePicker(false);
  }, [timeDigits, ampm]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>
      {isModal ? (
        <Header headerTitle="Add Task" hideBackButton />
      ) : (
        <Header
          headerTitle="Add Task"
          onBack={onBack}
          rightAction={{ icon: "check", onPress: handleSave, show: canSave }}
        />
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "android" ? "height" : "padding"}
      >
        <View style={styles.scrollWrapper}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.ScrollView
            onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
          {/* Task name */}
          <View style={styles.field}>
            <RNTextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Task name"
              placeholderTextColor={dimColor}
              style={[styles.titleInput, { color: textColor }]}
              allowFontScaling={false}
              autoFocus
              multiline
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          {/* List */}
          <HapticPressable onPress={() => setShowListPicker(true)} style={styles.field}>
            <StyledText style={[styles.fieldLabel, { color: textColor }]}>List</StyledText>
            <StyledText style={styles.fieldValue}>{selectedList?.title ?? "Inbox"}</StyledText>
          </HapticPressable>

          {/* Date */}
          <HapticPressable onPress={() => setShowDatePicker(true)} style={styles.field}>
            <StyledText style={[styles.fieldLabel, { color: textColor }]}>Date</StyledText>
            {date ? (
              <View style={styles.fieldValueRow}>
                <StyledText style={styles.fieldValue}>{formatDisplayDate(date)}</StyledText>
                <HapticPressable onPress={() => { setDate(undefined); setConfirmedTime(undefined); setTimeDigits(""); setAmPm("AM"); }}>
                  <StyledText style={styles.clearBtn}>CLEAR</StyledText>
                </HapticPressable>
              </View>
            ) : (
              <StyledText style={styles.fieldValue}>None</StyledText>
            )}
          </HapticPressable>

          {/* Time — only if date is set */}
          {date && (
            <HapticPressable onPress={() => setShowTimePicker(true)} style={styles.field}>
              <StyledText style={[styles.fieldLabel, { color: textColor }]}>Time</StyledText>
              {confirmedTime ? (
                <View style={styles.fieldValueRow}>
                  <StyledText style={styles.fieldValue}>{formatDisplayTime(timeDigits, ampm)}</StyledText>
                  <HapticPressable onPress={() => { setConfirmedTime(undefined); setTimeDigits(""); setAmPm("AM"); }}>
                    <StyledText style={styles.clearBtn}>CLEAR</StyledText>
                  </HapticPressable>
                </View>
              ) : (
                <StyledText style={styles.fieldValue}>None</StyledText>
              )}
            </HapticPressable>
          )}
          {/* Subtasks */}
          <View style={[styles.field, styles.subtasksField]}>
            <StyledText style={[styles.fieldLabel, { color: textColor }]}>Subtasks</StyledText>
            {subtasks.map((sub) => (
              <View key={sub.id} style={styles.subtaskRow}>
                <TaskCheckbox
                  checked={sub.completed}
                  onToggle={() => setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s))}
                  size={20}
                  paddingTop={10}
                />
                <StyledText style={styles.subtaskTitle}>{sub.title}</StyledText>
                <HapticPressable
                  onPress={() => setSubtasks(prev => prev.filter(s => s.id !== sub.id))}
                  style={styles.deleteSubtask}
                >
                  <StyledText style={styles.deleteSubtaskText}>×</StyledText>
                </HapticPressable>
              </View>
            ))}
            <RNTextInput
              value={newSubtask}
              onChangeText={setNewSubtask}
              placeholder="Add subtask…"
              onFocus={triggerHaptic}
              placeholderTextColor={dimColor}
              style={[styles.subtaskInput, { color: textColor }]}
              allowFontScaling={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                const t = newSubtask.trim();
                if (!t) return;
                setSubtasks(prev => [...prev, { id: `${Date.now()}`, title: t, completed: false }]);
                setNewSubtask("");
              }}
            />
          </View>
          </View>
          </Animated.ScrollView>
        </TouchableWithoutFeedback>
        {scrollIndicatorHeight > 0 && (
          <View style={[styles.scrollTrack, { backgroundColor: textColor }]}>
            <Animated.View style={[styles.scrollThumb, { backgroundColor: textColor, height: scrollIndicatorHeight, transform: [{ translateY: scrollIndicatorPosition }] }]} />
          </View>
        )}
        </View>
      </KeyboardAvoidingView>

      <DatePicker
        visible={showDatePicker}
        value={date}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        onDismiss={() => setShowDatePicker(false)}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onPrevMonth={() => {
          if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
          else setViewMonth(m => m - 1);
        }}
        onNextMonth={() => {
          if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
          else setViewMonth(m => m + 1);
        }}
      />

      <TimePicker
        visible={showTimePicker}
        digits={timeDigits}
        ampm={ampm}
        onDigit={(d) => setTimeDigits(prev => prev.length < 4 ? prev + d : prev)}
        onBackspace={() => setTimeDigits(prev => prev.slice(0, -1))}
        onAmPm={setAmPm}
        onConfirm={handleTimeConfirm}
        onDismiss={() => { setShowTimePicker(false); if (!confirmedTime) { setTimeDigits(""); setAmPm("AM"); } }}
      />

      <ListPickerModal
        visible={showListPicker}
        lists={lists}
        selectedId={selectedListId}
        onSelect={(list) => { setSelectedListId(list.id); setShowListPicker(false); }}
        onDismiss={() => setShowListPicker(false)}
      />

      {isModal && (
        <View style={styles.modalFooter}>
          <HapticPressable onPress={onBack} style={styles.modalFooterBtn}>
            <StyledText style={styles.modalDismissX}>✕</StyledText>
          </HapticPressable>
          <HapticPressable onPress={handleSave} style={styles.modalSaveBtn}>
            <StyledText style={styles.modalSave}>SAVE</StyledText>
          </HapticPressable>
        </View>
      )}

      <Toast
        visible={toastVisible}
        message="added"
        onHide={() => { setToastVisible(false); resetForm(true); onSaved(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  field: { paddingHorizontal: n(22), paddingVertical: n(13) },
  subtasksField: { paddingTop: n(28) },
  fieldLabel: { fontSize: n(14), marginBottom: n(4) },
  fieldValue: { fontSize: n(24), fontFamily: "PublicSans-Regular" },
  fieldValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearBtn: { fontSize: n(14), opacity: 0.4, paddingRight: n(18) },
  titleInput: { fontSize: n(30), fontFamily: "PublicSans-Regular", paddingVertical: n(4) },
  scrollWrapper: { flex: 1, position: "relative" },
  scrollTrack: { width: n(1), height: "100%", position: "absolute", right: n(18) },
  scrollThumb: { width: n(5), position: "absolute", right: n(-2) },
  subtaskRow: { flexDirection: "row", alignItems: "flex-start", paddingRight: n(8) },
  subtaskTitle: { flex: 1, fontSize: n(22), paddingVertical: n(7) },
  deleteSubtask: { paddingLeft: n(8), paddingRight: n(18), paddingVertical: n(8) },
  deleteSubtaskText: { fontSize: n(24) },
  subtaskInput: { fontSize: n(22), fontFamily: "PublicSans-Regular", paddingVertical: n(10) },
  modalFooter: { alignItems: "center", paddingBottom: n(20), paddingTop: n(6), position: "relative" },
  modalFooterBtn: { padding: n(8) },
  modalSaveBtn: { position: "absolute", right: n(24), top: n(6), padding: n(8) },
  modalDismissX: { fontSize: n(28) },
  modalSave: { fontSize: n(24), letterSpacing: n(5), fontFamily: "PublicSans-Regular" },
});
