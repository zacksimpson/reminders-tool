import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClearIcon } from "@/components/ClearIcon";
import { DatePicker } from "@/components/DatePicker";
import { DeleteIcon } from "@/components/DeleteIcon";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { ListPickerModal } from "@/components/ListPickerModal";
import { RecurrencePicker } from "@/components/RecurrencePicker";
import { StyledText } from "@/components/StyledText";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { TimePicker } from "@/components/TimePicker";
import { Toast } from "@/components/Toast";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import {
  formatRecurrence,
  generateId,
  type Recurrence,
  useReminders,
} from "@/contexts/RemindersContext";
import {
  scrollIndicatorBaseStyles,
  useScrollIndicator,
} from "@/hooks/useScrollIndicator";
import {
  digitsToTime,
  formatDisplayDate,
  formatDisplayTime,
} from "@/utils/dateTime";
import { triggerHaptic } from "@/utils/haptics";
import { n } from "@/utils/scaling";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TaskFormProps {
  defaultDate?: string; // "YYYY-MM-DD"
  defaultListId?: string;
  isModal?: boolean; // when true, hides header back/check and shows bottom × / SAVE footer
  onBack?: () => void; // override back button behavior (e.g. when used inside a Modal)
  onSaved: () => void; // called after task is saved (and toast dismissed if shown)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskForm({
  defaultListId,
  defaultDate,
  onSaved,
  onBack,
  isModal,
}: TaskFormProps) {
  const { invertColors } = useInvertColors();
  const { lists, settings, addTask } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#AAAAAA" : "#555555";

  const resolvedListId = defaultListId ?? settings.defaultListId;
  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();

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
  const [subtasks, setSubtasks] = useState<
    Array<{ id: string; title: string; completed: boolean }>
  >([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(
    undefined
  );
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);

  const selectedList = lists.find((l) => l.id === selectedListId) ?? lists[0];
  const canSave = title.trim().length > 0;

  const resetForm = useCallback(
    (keepList = false) => {
      setTitle("");
      if (!keepList) {
        setSelectedListId(resolvedListId);
      }
      setDate(defaultDate);
      setConfirmedTime(undefined);
      setTimeDigits("");
      setAmPm("AM");
      setSubtasks([]);
      setNewSubtask("");
      setRecurrence(undefined);
    },
    [resolvedListId, defaultDate]
  );

  const handleSave = useCallback(() => {
    if (!canSave) {
      return;
    }
    Keyboard.dismiss();
    addTask({
      title: title.trim(),
      listId: selectedListId,
      date,
      time: confirmedTime,
      recurrence,
      subtasks: subtasks.map((s) => ({
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
  }, [
    canSave,
    title,
    selectedListId,
    date,
    confirmedTime,
    recurrence,
    subtasks,
    settings,
    addTask,
    resetForm,
    onSaved,
  ]);

  const handleTimeConfirm = useCallback(() => {
    if (timeDigits.length !== 3 && timeDigits.length !== 4) {
      return;
    }
    setConfirmedTime(digitsToTime(timeDigits, ampm));
    setShowTimePicker(false);
  }, [timeDigits, ampm]);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: bg }]}
    >
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
        behavior={Platform.OS === "android" ? "height" : "padding"}
        style={styles.flex}
      >
        <View style={styles.scrollWrapper}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.ScrollView
              keyboardShouldPersistTaps="handled"
              onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
              onScroll={handleScroll}
              overScrollMode="never"
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              <View
                onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
              >
                {/* Task name */}
                <View style={styles.field}>
                  <RNTextInput
                    allowFontScaling={false}
                    autoFocus
                    blurOnSubmit
                    cursorColor={textColor}
                    multiline
                    onChangeText={setTitle}
                    onSubmitEditing={Keyboard.dismiss}
                    placeholder="Task name"
                    placeholderTextColor={dimColor}
                    returnKeyType="done"
                    selectionColor={textColor}
                    style={[styles.titleInput, { color: textColor }]}
                    value={title}
                  />
                </View>

                {/* List */}
                <HapticPressable
                  onPress={() => setShowListPicker(true)}
                  style={styles.field}
                >
                  <StyledText style={[styles.fieldLabel, { color: textColor }]}>
                    List
                  </StyledText>
                  <StyledText style={styles.fieldValue}>
                    {selectedList?.title ?? "Inbox"}
                  </StyledText>
                </HapticPressable>

                {/* Date */}
                <HapticPressable
                  onPress={() => setShowDatePicker(true)}
                  style={styles.field}
                >
                  <StyledText style={[styles.fieldLabel, { color: textColor }]}>
                    Date
                  </StyledText>
                  {date ? (
                    <View style={styles.fieldValueRow}>
                      <StyledText style={styles.fieldValue}>
                        {formatDisplayDate(date)}
                      </StyledText>
                      <HapticPressable
                        onPress={() => {
                          setDate(undefined);
                          setConfirmedTime(undefined);
                          setTimeDigits("");
                          setAmPm("AM");
                          setRecurrence(undefined);
                        }}
                        style={styles.clearBtn}
                      >
                        <ClearIcon />
                      </HapticPressable>
                    </View>
                  ) : (
                    <StyledText style={styles.fieldValue}>None</StyledText>
                  )}
                </HapticPressable>

                {/* Time — only if date is set */}
                {date && (
                  <HapticPressable
                    onPress={() => setShowTimePicker(true)}
                    style={styles.field}
                  >
                    <StyledText
                      style={[styles.fieldLabel, { color: textColor }]}
                    >
                      Time
                    </StyledText>
                    {confirmedTime ? (
                      <View style={styles.fieldValueRow}>
                        <StyledText style={styles.fieldValue}>
                          {formatDisplayTime(timeDigits, ampm)}
                        </StyledText>
                        <HapticPressable
                          onPress={() => {
                            setConfirmedTime(undefined);
                            setTimeDigits("");
                            setAmPm("AM");
                          }}
                          style={styles.clearBtn}
                        >
                          <ClearIcon />
                        </HapticPressable>
                      </View>
                    ) : (
                      <StyledText style={styles.fieldValue}>None</StyledText>
                    )}
                  </HapticPressable>
                )}
                {/* Recurring — only if date is set */}
                {date && (
                  <HapticPressable
                    onPress={() => setShowRecurrencePicker(true)}
                    style={styles.field}
                  >
                    <StyledText
                      style={[styles.fieldLabel, { color: textColor }]}
                    >
                      Recurring
                    </StyledText>
                    {recurrence ? (
                      <View style={styles.fieldValueRow}>
                        <StyledText style={styles.fieldValue}>
                          {formatRecurrence(recurrence)}
                        </StyledText>
                        <HapticPressable
                          onPress={() => setRecurrence(undefined)}
                          style={styles.clearBtn}
                        >
                          <ClearIcon />
                        </HapticPressable>
                      </View>
                    ) : (
                      <StyledText style={styles.fieldValue}>None</StyledText>
                    )}
                  </HapticPressable>
                )}

                {/* Subtasks */}
                <View style={styles.subtasksHeader}>
                  <StyledText style={[styles.fieldLabel, { color: textColor }]}>
                    Subtasks
                  </StyledText>
                </View>
                {subtasks.map((sub) => (
                  <View key={sub.id} style={styles.subtaskRow}>
                    <View style={styles.subtaskCheckboxIcon}>
                      <TaskCheckbox
                        checked={sub.completed}
                        onToggle={() =>
                          setSubtasks((prev) =>
                            prev.map((s) =>
                              s.id === sub.id
                                ? { ...s, completed: !s.completed }
                                : s
                            )
                          )
                        }
                        paddingBottom={0}
                        paddingTop={0}
                        size={20}
                      />
                    </View>
                    <StyledText style={styles.subtaskTitle}>
                      {sub.title}
                    </StyledText>
                    <View style={styles.subtaskDeleteIcon}>
                      <HapticPressable
                        onPress={() =>
                          setSubtasks((prev) =>
                            prev.filter((s) => s.id !== sub.id)
                          )
                        }
                        style={styles.deleteSubtask}
                      >
                        <DeleteIcon />
                      </HapticPressable>
                    </View>
                  </View>
                ))}
                <View style={styles.subtaskInputRow}>
                  <RNTextInput
                    allowFontScaling={false}
                    cursorColor={textColor}
                    onChangeText={setNewSubtask}
                    onFocus={triggerHaptic}
                    onSubmitEditing={() => {
                      const t = newSubtask.trim();
                      if (!t) {
                        return;
                      }
                      setSubtasks((prev) => [
                        ...prev,
                        { id: generateId(), title: t, completed: false },
                      ]);
                      setNewSubtask("");
                    }}
                    placeholder="Add subtask…"
                    placeholderTextColor={dimColor}
                    returnKeyType="done"
                    selectionColor={textColor}
                    style={[styles.subtaskInput, { color: textColor }]}
                    value={newSubtask}
                  />
                </View>
              </View>
            </Animated.ScrollView>
          </TouchableWithoutFeedback>
          {scrollIndicatorHeight > 0 && (
            <View style={[styles.scrollTrack, { backgroundColor: textColor }]}>
              <Animated.View
                style={[
                  styles.scrollThumb,
                  {
                    backgroundColor: textColor,
                    height: scrollIndicatorHeight,
                    transform: [{ translateY: scrollIndicatorPosition }],
                  },
                ]}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <DatePicker
        onDismiss={() => setShowDatePicker(false)}
        onNextMonth={() => {
          if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
          } else {
            setViewMonth((m) => m + 1);
          }
        }}
        onPrevMonth={() => {
          if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
          } else {
            setViewMonth((m) => m - 1);
          }
        }}
        onSelect={(d) => {
          setDate(d);
          setShowDatePicker(false);
        }}
        value={date}
        viewMonth={viewMonth}
        viewYear={viewYear}
        visible={showDatePicker}
      />

      <TimePicker
        ampm={ampm}
        digits={timeDigits}
        onAmPm={setAmPm}
        onBackspace={() => setTimeDigits((prev) => prev.slice(0, -1))}
        onConfirm={handleTimeConfirm}
        onDigit={(d) =>
          setTimeDigits((prev) => (prev.length < 4 ? prev + d : prev))
        }
        onDismiss={() => {
          setShowTimePicker(false);
          if (!confirmedTime) {
            setTimeDigits("");
            setAmPm("AM");
          }
        }}
        visible={showTimePicker}
      />

      <RecurrencePicker
        onDismiss={() => setShowRecurrencePicker(false)}
        onSave={(r) => {
          setRecurrence(r);
          setShowRecurrencePicker(false);
        }}
        value={recurrence}
        visible={showRecurrencePicker}
      />

      <ListPickerModal
        lists={lists}
        onDismiss={() => setShowListPicker(false)}
        onSelect={(list) => {
          setSelectedListId(list.id);
          setShowListPicker(false);
        }}
        selectedId={selectedListId}
        visible={showListPicker}
      />

      {isModal && (
        <View style={styles.modalFooter}>
          <View style={styles.modalFooterSide} />
          <HapticPressable onPress={onBack} style={styles.modalFooterBtn}>
            <StyledText style={styles.modalDismissX}>✕</StyledText>
          </HapticPressable>
          <View style={styles.modalFooterSide}>
            <HapticPressable onPress={handleSave} style={styles.modalSaveBtn}>
              <StyledText style={styles.modalSave}>SAVE</StyledText>
            </HapticPressable>
          </View>
        </View>
      )}

      <Toast
        message="added"
        onHide={() => {
          setToastVisible(false);
          resetForm(true);
          onSaved();
        }}
        visible={toastVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  field: { paddingHorizontal: n(22), paddingVertical: n(13) },
  fieldLabel: { fontSize: n(14), marginBottom: n(4) },
  fieldValue: { fontSize: n(24), fontFamily: "PublicSans-Regular" },
  fieldValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearBtn: { paddingRight: n(18) },
  titleInput: {
    fontSize: n(30),
    fontFamily: "PublicSans-Regular",
    paddingVertical: n(4),
  },
  scrollWrapper: { flex: 1, position: "relative" },
  scrollTrack: scrollIndicatorBaseStyles.track,
  scrollThumb: scrollIndicatorBaseStyles.thumb,
  subtasksHeader: {
    paddingHorizontal: n(22),
    paddingTop: n(28),
    paddingBottom: n(12),
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: n(22),
  },
  subtaskCheckboxIcon: { alignSelf: "flex-start", paddingTop: n(14) },
  subtaskDeleteIcon: { alignSelf: "flex-start", paddingTop: n(17) },
  subtaskTitle: { flex: 1, fontSize: n(22), paddingVertical: n(10) },
  deleteSubtask: {
    paddingLeft: n(8),
    paddingRight: n(18),
    paddingBottom: n(8),
  },
  subtaskInputRow: { paddingHorizontal: n(22), paddingVertical: n(10) },
  subtaskInput: { fontSize: n(22), fontFamily: "PublicSans-Regular" },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: n(14),
  },
  modalFooterSide: { flex: 1, alignItems: "flex-end", paddingRight: n(24) },
  modalFooterBtn: { padding: n(8) },
  modalSaveBtn: { padding: n(8) },
  modalDismissX: { fontSize: n(28) },
  modalSave: {
    fontSize: n(24),
    letterSpacing: n(5),
    fontFamily: "PublicSans-Regular",
  },
});
