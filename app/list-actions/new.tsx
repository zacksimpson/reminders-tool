import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

export default function NewListScreen() {
  const { invertColors } = useInvertColors();
  const { addList } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#AAAAAA" : "#555555";

  const [title, setTitle] = useState("");
  const canSave = title.trim().length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) {
      return;
    }
    addList(title.trim());
    router.back();
  }, [canSave, title, addList]);

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <View style={[styles.fill, { backgroundColor: bg }]}>
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
          <SafeAreaView edges={["top"]} style={styles.fill}>
            <Header
              headerTitle="New List"
              rightAction={{
                icon: "check",
                onPress: handleSave,
                show: canSave,
              }}
            />
            <View style={styles.inputArea}>
              <TextInput
                allowFontScaling={false}
                autoFocus
                cursorColor={textColor}
                onChangeText={setTitle}
                onSubmitEditing={handleSave}
                placeholder="List name"
                placeholderTextColor={textColor}
                returnKeyType="done"
                selectionColor={textColor}
                style={[styles.input, { color: textColor }]}
                value={title}
              />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  inputArea: { paddingHorizontal: n(22), paddingTop: n(24) },
  input: {
    fontSize: n(30),
    fontFamily: "PublicSans-Regular",
    paddingBottom: n(8),
  },
});
