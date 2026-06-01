import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
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
  const newSubtaskRef = useRef("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
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
      newSubtaskRef.current = "";
      setShowSubtaskInput(false);
      setEditingSubtaskId(null);
      setEditingSubtaskTitle("");
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
            <Animated.ScrollView
              keyboardDismissMode="on-drag"
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
                    placeholderTextColor={textColor}
                    returnKeyType="done"
                    selectionColor={textColor}
                    style={[styles.titleInput, { color: textColor, borderBottomColor: textColor }]}
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
                    {editingSubtaskId === sub.id ? (
                      <RNTextInput
                        allowFontScaling={false}
                        autoFocus
                        blurOnSubmit
                        cursorColor={textColor}
                        multiline
                        onBlur={() => {
                          const t = editingSubtaskTitle.trim();
                          setEditingSubtaskId(null);
                          if (t) {
                            setSubtasks((prev) =>
                              prev.map((s) =>
                                s.id === sub.id ? { ...s, title: t } : s
                              )
                            );
                          }
                        }}
                        onChangeText={setEditingSubtaskTitle}
                        onSubmitEditing={() => {
                          const t = editingSubtaskTitle.trim();
                          setEditingSubtaskId(null);
                          if (t) {
                            setSubtasks((prev) =>
                              prev.map((s) =>
                                s.id === sub.id ? { ...s, title: t } : s
                              )
                            );
                          }
                        }}
                        returnKeyType="done"
                        selectionColor={textColor}
                        style={[styles.subtaskTitle, { color: textColor, paddingLeft: 0 }]}
                        value={editingSubtaskTitle}
                      />
                    ) : (
                      <HapticPressable
                        onPress={() => {
                          setEditingSubtaskId(sub.id);
                          setEditingSubtaskTitle(sub.title);
                        }}
                        style={{ flex: 1 }}
                      >
                        <StyledText style={styles.subtaskTitle}>
                          {sub.title}
                        </StyledText>
                      </HapticPressable>
                    )}
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
                {showSubtaskInput ? (
                  <View style={styles.subtaskRow}>
                    <View style={styles.subtaskCheckboxIcon}>
                      <HapticPressable
                        onPress={() => {
                          const t = newSubtaskRef.current.trim();
                          if (t) {
                            setSubtasks((prev) => [
                              ...prev,
                              { id: generateId(), title: t, completed: false },
                            ]);
                          }
                          newSubtaskRef.current = "";
                          setNewSubtask("");
                          setShowSubtaskInput(false);
                        }}
                        style={styles.plusIconWrapper}
                      >
                        <Svg
                          fill="none"
                          height={n(20)}
                          viewBox="0 0 84 84"
                          width={n(20)}
                        >
                          <Path
                            d="M42.0068 0.5C64.8971 0.500151 83.5 19.1215 83.5 42.0098C83.5 64.8984 64.8935 83.4998 42.0068 83.5C19.1203 83.5 0.5 64.8987 0.5 42.0098C0.500041 19.1212 19.12 0.5 42.0068 0.5ZM42.0068 6.625C22.4399 6.625 6.62797 22.4411 6.62793 42.0098C6.62793 61.5749 22.4396 77.375 42.0068 77.375C61.5705 77.3749 77.3682 61.5783 77.3682 42.0098C77.3681 22.4433 61.5733 6.62515 42.0068 6.625ZM45.0654 38.9375H60.1494C60.8631 38.9348 61.5518 39.1833 62.0986 39.6289L62.3242 39.832L62.3252 39.834C62.9032 40.4122 63.2244 41.1966 63.2207 42.0117C63.2169 42.8232 62.8916 43.5996 62.3184 44.1729L62.3164 44.1758C61.7403 44.7443 60.9612 45.0646 60.1494 45.0615V45.0625H45.0654V60.1514C45.0693 60.9643 44.7472 61.745 44.1738 62.3223C43.6004 62.8996 42.8236 63.2253 42.0078 63.2256L42.0088 63.2266C41.1924 63.2304 40.4082 62.9043 39.834 62.3301C39.2568 61.7528 38.9307 60.9683 38.9346 60.1514V45.0625H23.8516V45.0615C23.0395 45.0648 22.2599 44.7445 21.6836 44.1758L21.6816 44.1729C21.1084 43.5996 20.7831 42.8232 20.7793 42.0117C20.7756 41.1965 21.0966 40.4112 21.6748 39.833L21.6758 39.832C22.2521 39.2595 23.0355 38.9342 23.8516 38.9375H38.9346V23.8506C38.9384 23.0363 39.2635 22.26 39.8369 21.6865L39.8379 21.6855C40.4146 21.1126 41.1947 20.7897 42.0068 20.793C43.6947 20.7968 45.0615 22.1638 45.0654 23.8516V38.9375Z"
                            fill={textColor}
                            stroke={textColor}
                          />
                        </Svg>
                      </HapticPressable>
                    </View>
                    <RNTextInput
                      allowFontScaling={false}
                      autoFocus
                      cursorColor={textColor}
                      onBlur={() => {
                        setShowSubtaskInput(false);
                        setNewSubtask("");
                      }}
                      onChangeText={(text) => {
                        newSubtaskRef.current = text;
                        setNewSubtask(text);
                      }}
                      onFocus={triggerHaptic}
                      onSubmitEditing={() => {
                        const t = newSubtaskRef.current.trim();
                        if (t) {
                          setSubtasks((prev) => [
                            ...prev,
                            { id: generateId(), title: t, completed: false },
                          ]);
                        }
                        newSubtaskRef.current = "";
                        setNewSubtask("");
                        setShowSubtaskInput(false);
                      }}
                      placeholder="Add subtask…"
                      placeholderTextColor={textColor}
                      returnKeyType="done"
                      selectionColor={textColor}
                      style={[styles.subtaskTitle, { color: textColor, paddingLeft: 0 }]}
                      value={newSubtask}
                    />
                  </View>
                ) : (
                  <HapticPressable
                    onPress={() => setShowSubtaskInput(true)}
                    style={styles.addSubtaskBtn}
                  >
                    <Svg
                      fill="none"
                      height={n(20)}
                      viewBox="0 0 84 84"
                      width={n(20)}
                    >
                      <Path
                        d="M42.0068 0.5C64.8971 0.500151 83.5 19.1215 83.5 42.0098C83.5 64.8984 64.8935 83.4998 42.0068 83.5C19.1203 83.5 0.5 64.8987 0.5 42.0098C0.500041 19.1212 19.12 0.5 42.0068 0.5ZM42.0068 6.625C22.4399 6.625 6.62797 22.4411 6.62793 42.0098C6.62793 61.5749 22.4396 77.375 42.0068 77.375C61.5705 77.3749 77.3682 61.5783 77.3682 42.0098C77.3681 22.4433 61.5733 6.62515 42.0068 6.625ZM45.0654 38.9375H60.1494C60.8631 38.9348 61.5518 39.1833 62.0986 39.6289L62.3242 39.832L62.3252 39.834C62.9032 40.4122 63.2244 41.1966 63.2207 42.0117C63.2169 42.8232 62.8916 43.5996 62.3184 44.1729L62.3164 44.1758C61.7403 44.7443 60.9612 45.0646 60.1494 45.0615V45.0625H45.0654V60.1514C45.0693 60.9643 44.7472 61.745 44.1738 62.3223C43.6004 62.8996 42.8236 63.2253 42.0078 63.2256L42.0088 63.2266C41.1924 63.2304 40.4082 62.9043 39.834 62.3301C39.2568 61.7528 38.9307 60.9683 38.9346 60.1514V45.0625H23.8516V45.0615C23.0395 45.0648 22.2599 44.7445 21.6836 44.1758L21.6816 44.1729C21.1084 43.5996 20.7831 42.8232 20.7793 42.0117C20.7756 41.1965 21.0966 40.4112 21.6748 39.833L21.6758 39.832C22.2521 39.2595 23.0355 38.9342 23.8516 38.9375H38.9346V23.8506C38.9384 23.0363 39.2635 22.26 39.8369 21.6865L39.8379 21.6855C40.4146 21.1126 41.1947 20.7897 42.0068 20.793C43.6947 20.7968 45.0615 22.1638 45.0654 23.8516V38.9375Z"
                        fill={textColor}
                        stroke={textColor}
                      />
                    </Svg>
                  </HapticPressable>
                )}
              </View>
            </Animated.ScrollView>
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
    paddingLeft: 0,
    borderBottomWidth: 3,
    marginRight: n(18),
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
    paddingLeft: n(8),
    paddingRight: n(22),
  },
  subtaskCheckboxIcon: { alignSelf: "flex-start", paddingTop: n(15) },
  subtaskDeleteIcon: { alignSelf: "flex-start", paddingTop: n(17) },
  subtaskTitle: { flex: 1, fontSize: n(22), paddingVertical: n(10) },
  deleteSubtask: {
    paddingLeft: n(8),
    paddingRight: n(18),
    paddingBottom: n(8),
  },
  addSubtaskBtn: { marginLeft: n(8), paddingHorizontal: n(14), paddingTop: n(15), paddingBottom: n(14) },
  plusIconWrapper: { paddingHorizontal: n(14) },
  subtaskInputRow: { paddingLeft: n(48), paddingRight: n(22), paddingVertical: n(10) },
  subtaskInput: { fontSize: n(22), fontFamily: "PublicSans-Regular", paddingLeft: 0 },
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
