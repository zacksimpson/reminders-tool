import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Animated,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DatePicker } from "@/components/DatePicker";
import { RecurrencePicker } from "@/components/RecurrencePicker";
import { Header } from "@/components/Header";
import { HapticPressable } from "@/components/HapticPressable";
import { ListPickerModal } from "@/components/ListPickerModal";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { TimePicker } from "@/components/TimePicker";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { triggerHaptic } from "@/utils/haptics";
import { useReminders, type Recurrence, formatRecurrence } from "@/contexts/RemindersContext";
import { useScrollIndicator } from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

function formatDisplayDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[mo - 1]} ${d}, ${y}`;
}

function timeToDisplayParts(time24: string): { digits: string; ampm: "AM" | "PM" } {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return { digits: `${String(h).padStart(2, "0")}${mStr}`, ampm };
}

function digitsToTime(digits: string, ampm: "AM" | "PM"): string {
  // 3 digits: H:MM (e.g. "630" → hour=6, mins="30")
  // 4 digits: HH:MM (e.g. "1230" → hour=12, mins="30")
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

function formatDisplayTime(digits: string, ampm: "AM" | "PM"): string {
  const h = parseInt(digits.slice(0, 2), 10);
  const m = digits.slice(2, 4);
  return `${h}:${m} ${ampm}`;
}

export default function TaskScreen() {
  const { id, confirmed, action } = useLocalSearchParams<{ id: string; confirmed?: string; action?: string }>();
  const { invertColors } = useInvertColors();
  const { tasks, lists, updateTask, deleteTask, toggleSubtask, addSubtask, deleteSubtask } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#AAAAAA" : "#555555";

  const { handleScroll, scrollIndicatorHeight, scrollIndicatorPosition, setContentHeight, setScrollViewHeight } = useScrollIndicator();

  const task = tasks.find(t => t.id === id);

  // Handle returning from confirm screen
  useEffect(() => {
    if (confirmed === "true" && action === `delete-task:${id}`) {
      deleteTask(id);
      router.back();
    }
  }, [confirmed, action, id, deleteTask]);
  const [title, setTitle] = useState(task?.title ?? "");
  const [listId, setListId] = useState(task?.listId ?? "");
  const [date, setDate] = useState<string | undefined>(task?.date);
  const [confirmedTime, setConfirmedTime] = useState<string | undefined>(task?.time);
  const initTimeParts = task?.time ? timeToDisplayParts(task.time) : { digits: "", ampm: "AM" as const };
  const [timeDigits, setTimeDigits] = useState(initTimeParts.digits);
  const [ampm, setAmPm] = useState<"AM" | "PM">(initTimeParts.ampm);
  const [newSubtask, setNewSubtask] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(task?.recurrence);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const subtaskInputRef = useRef<RNTextInput>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  const selectedList = lists.find(l => l.id === listId);

  const handleSave = useCallback(() => {
    if (!task || !title.trim()) return;
    updateTask(task.id, { title: title.trim(), listId, date, time: confirmedTime, recurrence });
    router.back();
  }, [task, title, listId, date, confirmedTime, updateTask]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    const message = task.recurrence
      ? `This is a recurring task. Delete all occurrences?`
      : `Are you sure you want to delete "${task.title}"?`;
    router.push({
      pathname: "/confirm",
      params: {
        message,
        confirmText: "Delete",
        action: `delete-task:${task.id}`,
        returnPath: `/task/${id}` as any,
      },
    });
  }, [task]);

  const handleRenameSubtask = useCallback((subtaskId: string) => {
    const t = editingSubtaskTitle.trim();
    setEditingSubtaskId(null);
    if (!t || !task) return;
    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (!subtask || t === subtask.title) return;
    const updatedSubtasks = task.subtasks.map(s =>
      s.id === subtaskId ? { ...s, title: t } : s
    );
    updateTask(task.id, { subtasks: updatedSubtasks });
  }, [editingSubtaskTitle, task, updateTask]);

  const handleAddSubtask = useCallback(() => {
    const t = newSubtask.trim();
    if (!t || !task) return;
    addSubtask(task.id, t);
    setNewSubtask("");
  }, [newSubtask, task, addSubtask]);

  const handleTimeConfirm = useCallback(() => {
    if (timeDigits.length !== 3 && timeDigits.length !== 4) return;
    setConfirmedTime(digitsToTime(timeDigits, ampm));
    setShowTimePicker(false);
  }, [timeDigits, ampm]);

  if (!task) {
    return (
      <SwipeBackContainer onSwipeBack={() => router.back()}>
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>
          <Header />
          <View style={styles.empty}><StyledText style={styles.emptyText}>task not found</StyledText></View>
        </SafeAreaView>
      </SwipeBackContainer>
    );
  }

  return (
    <SwipeBackContainer onSwipeBack={handleSave}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>
        <Header headerTitle="Edit" rightAction={{ icon: "check", onPress: handleSave }} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "android" ? "height" : "padding"}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.scrollWrapper}>
            <Animated.ScrollView
              onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>

                <View style={styles.field}>
                  <RNTextInput value={title} onChangeText={setTitle} placeholder="Task name" placeholderTextColor={dimColor} style={[styles.titleInput, { color: textColor }]} allowFontScaling={false} multiline blurOnSubmit returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
                </View>

                <HapticPressable onPress={() => setShowListPicker(true)} style={styles.field}>
                  <StyledText style={styles.fieldLabel}>List</StyledText>
                  <StyledText style={styles.fieldValue}>{selectedList?.title ?? "Inbox"}</StyledText>
                </HapticPressable>

                <HapticPressable onPress={() => setShowDatePicker(true)} style={styles.field}>
                  <StyledText style={styles.fieldLabel}>Date</StyledText>
                  {date ? (
                    <View style={styles.fieldValueRow}>
                      <StyledText style={styles.fieldValue}>{formatDisplayDate(date)}</StyledText>
                      <HapticPressable onPress={() => { setDate(undefined); setConfirmedTime(undefined); setTimeDigits(""); setAmPm("AM"); setRecurrence(undefined); }}>
                        <StyledText style={styles.clearBtn}>CLEAR</StyledText>
                      </HapticPressable>
                    </View>
                  ) : (
                    <StyledText style={styles.fieldValue}>None</StyledText>
                  )}
                </HapticPressable>

                {date && (
                  <HapticPressable onPress={() => setShowTimePicker(true)} style={styles.field}>
                    <StyledText style={styles.fieldLabel}>Time</StyledText>
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

                {/* Recurring — only if date is set */}
                {date && (
                  <HapticPressable onPress={() => setShowRecurrencePicker(true)} style={styles.field}>
                    <StyledText style={styles.fieldLabel}>Recurring</StyledText>
                    {recurrence ? (
                      <View style={styles.fieldValueRow}>
                        <StyledText style={[styles.fieldValue, { color: textColor }]}>{formatRecurrence(recurrence)}</StyledText>
                        <HapticPressable onPress={() => setRecurrence(undefined)}>
                          <StyledText style={styles.clearBtn}>CLEAR</StyledText>
                        </HapticPressable>
                      </View>
                    ) : (
                      <StyledText style={[styles.fieldValue, { color: textColor }]}>None</StyledText>
                    )}
                  </HapticPressable>
                )}

                <View style={styles.sectionHeader}>
                  <StyledText style={styles.sectionLabel}>Subtasks</StyledText>
                </View>

                {task.subtasks.map(sub => (
                  <View key={sub.id} style={styles.subtaskRow}>
                    <TaskCheckbox checked={sub.completed} onToggle={() => toggleSubtask(task.id, sub.id)} size={20} paddingTop={13} />
                    {editingSubtaskId === sub.id ? (
                      <RNTextInput
                        autoFocus
                        value={editingSubtaskTitle}
                        onChangeText={setEditingSubtaskTitle}
                        onSubmitEditing={() => handleRenameSubtask(sub.id)}
                        onBlur={() => handleRenameSubtask(sub.id)}
                        style={[styles.subtaskTitle, { color: textColor }]}
                        allowFontScaling={false}
                        multiline
                        blurOnSubmit
                        returnKeyType="done"
                      />
                    ) : (
                      <HapticPressable
                        onPress={() => { setEditingSubtaskId(sub.id); setEditingSubtaskTitle(sub.title); }}
                        style={{ flex: 1 }}
                      >
                        <StyledText style={[styles.subtaskTitle, sub.completed && styles.taskDone]}>{sub.title}</StyledText>
                      </HapticPressable>
                    )}
                    <HapticPressable onPress={() => deleteSubtask(task.id, sub.id)} style={styles.deleteSubtask}>
                      <StyledText style={styles.deleteSubtaskText}>×</StyledText>
                    </HapticPressable>
                  </View>
                ))}

                <View style={styles.subtaskInputRow}>
                  <RNTextInput ref={subtaskInputRef} value={newSubtask} onChangeText={setNewSubtask} placeholder="Add subtask…"
              onFocus={triggerHaptic} placeholderTextColor={dimColor} style={[styles.subtaskField, { color: textColor }]} allowFontScaling={false} returnKeyType="done" onSubmitEditing={handleAddSubtask} />
                </View>

                <HapticPressable onPress={handleDelete} style={styles.deleteRow}>
                  <StyledText style={styles.deleteText}>DELETE</StyledText>
                </HapticPressable>

              </View>
            </Animated.ScrollView>
            {scrollIndicatorHeight > 0 && (
              <View style={[styles.scrollTrack, { backgroundColor: textColor }]}>
                <Animated.View style={[styles.scrollThumb, { backgroundColor: textColor, height: scrollIndicatorHeight, transform: [{ translateY: scrollIndicatorPosition }] }]} />
              </View>
            )}
          </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        <RecurrencePicker
          visible={showRecurrencePicker}
          value={recurrence}
          onSave={(r) => { setRecurrence(r); setShowRecurrencePicker(false); }}
          onDismiss={() => setShowRecurrencePicker(false)}
        />
        <DatePicker visible={showDatePicker} value={date} onSelect={(d) => { setDate(d); setShowDatePicker(false); }} onDismiss={() => setShowDatePicker(false)} viewYear={viewYear} viewMonth={viewMonth} onPrevMonth={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }} onNextMonth={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }} />
        <TimePicker visible={showTimePicker} digits={timeDigits} ampm={ampm} onDigit={(d) => setTimeDigits(prev => prev.length < 4 ? prev + d : prev)} onBackspace={() => setTimeDigits(prev => prev.slice(0, -1))} onAmPm={setAmPm} onConfirm={handleTimeConfirm} onDismiss={() => { setShowTimePicker(false); if (!confirmedTime) { setTimeDigits(""); setAmPm("AM"); } }} />
        <ListPickerModal visible={showListPicker} lists={lists} selectedId={listId} onSelect={(list) => { setListId(list.id); setShowListPicker(false); }} onDismiss={() => setShowListPicker(false)} />
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1, flexDirection: "row", position: "relative" },
  scrollTrack: { width: n(1), height: "100%", position: "absolute", right: n(18) },
  scrollThumb: { width: n(5), position: "absolute", right: n(-2) },
  field: { paddingHorizontal: n(22), paddingVertical: n(13) },
  subtasksField: { paddingTop: n(28) },
  fieldLabel: { fontSize: n(14), marginBottom: n(4) },
  fieldValue: { fontSize: n(24), fontFamily: "PublicSans-Regular" },
  fieldValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearBtn: { fontSize: n(14), opacity: 0.4, paddingRight: n(18) },
  titleInput: { fontSize: n(30), fontFamily: "PublicSans-Regular", paddingVertical: n(4) },
  sectionHeader: { paddingHorizontal: n(22), paddingVertical: n(12) },
  sectionLabel: { fontSize: n(14) },
  subtaskRow: { flexDirection: "row", alignItems: "flex-start", paddingRight: n(22) },
  subtaskTitle: { flex: 1, fontSize: n(22), paddingVertical: n(10) },
  taskDone: {},
  deleteSubtask: { paddingLeft: n(8), paddingRight: n(18), paddingVertical: n(8) },
  deleteSubtaskText: { fontSize: n(28) },
  subtaskInputRow: { paddingHorizontal: n(22), paddingVertical: n(10) },
  subtaskField: { fontSize: n(22), fontFamily: "PublicSans-Regular" },
  deleteRow: { paddingHorizontal: n(22), paddingVertical: n(28), alignItems: "center" },
  deleteText: { fontSize: n(24), letterSpacing: n(5) },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: n(20), opacity: 0.4 },
});
