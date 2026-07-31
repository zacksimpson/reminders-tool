import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useAuth } from "@/contexts/AuthContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { formatLastSyncedAt } from "@/utils/dateTime";
import { n } from "@/utils/scaling";

/**
 * Sign in with the same account used on reminders-web, for phone<->desktop sync.
 */
export default function AccountScreen() {
  const { invertColors } = useInvertColors();
  const {
    authState,
    error,
    isSigningIn,
    isSyncing,
    lastSyncedAt,
    signIn,
    signOut,
    syncError,
    syncNow,
  } = useAuth();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const canSignIn = email.trim().length > 0 && password.length > 0;

  const handleSignIn = () => signIn(email, password);

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header headerTitle="Account" />

        <HapticPressable
          onPress={() => router.push("/settings/about-desktop-sync")}
          style={styles.aboutRow}
        >
          <StyledText style={styles.aboutText}>About Desktop Sync</StyledText>
        </HapticPressable>

        {authState.status === "signed-in" && (
          <View style={styles.signedInContainer}>
            <View>
              <StyledText style={styles.smallLabel}>Signed in</StyledText>
              <StyledText numberOfLines={1} style={styles.email}>
                {authState.email}
              </StyledText>
              <HapticPressable onPress={syncNow} style={styles.row}>
                <StyledText style={styles.selectorLabel}>
                  Last Synced
                </StyledText>
                <StyledText style={styles.selectorValue}>
                  {getLastSyncedLabel(isSyncing, lastSyncedAt)}
                </StyledText>
              </HapticPressable>
              {syncError && (
                <StyledText style={styles.errorText}>{syncError}</StyledText>
              )}
            </View>
            <HapticPressable onPress={signOut} style={styles.signOutWrapper}>
              <StyledText style={styles.confirmText}>SIGN OUT</StyledText>
            </HapticPressable>
          </View>
        )}

        {authState.status === "signed-out" && (
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.formContainer}
          >
            <ScrollView
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.field}>
                <StyledText style={styles.fieldLabel}>Email</StyledText>
                <TextInput
                  allowFontScaling={false}
                  autoCapitalize="none"
                  autoCorrect={false}
                  cursorColor={textColor}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  returnKeyType="next"
                  selectionColor={textColor}
                  style={[
                    styles.input,
                    { color: textColor, borderBottomColor: textColor },
                  ]}
                  value={email}
                />
              </View>
              <View style={styles.field}>
                <StyledText style={styles.fieldLabel}>Password</StyledText>
                <TextInput
                  allowFontScaling={false}
                  autoCapitalize="none"
                  autoCorrect={false}
                  cursorColor={textColor}
                  onChangeText={setPassword}
                  onSubmitEditing={handleSignIn}
                  returnKeyType="done"
                  secureTextEntry
                  selectionColor={textColor}
                  style={[
                    styles.input,
                    { color: textColor, borderBottomColor: textColor },
                  ]}
                  value={password}
                />
              </View>

              {error && <StyledText style={styles.errorText}>{error}</StyledText>}

              {canSignIn && (
                <HapticPressable
                  disabled={isSigningIn}
                  onPress={handleSignIn}
                  style={[styles.signInBtn, isSigningIn && styles.rowDisabled]}
                >
                  <StyledText style={styles.signInText}>
                    {isSigningIn ? "SIGNING IN…" : "SIGN IN"}
                  </StyledText>
                </HapticPressable>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

function getLastSyncedLabel(
  isSyncing: boolean,
  lastSyncedAt: number | null
): string {
  if (isSyncing) {
    return "Syncing…";
  }
  if (lastSyncedAt) {
    return formatLastSyncedAt(lastSyncedAt);
  }
  return "Never, tap to sync now";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  aboutRow: { paddingHorizontal: n(22), paddingVertical: n(16) },
  aboutText: { fontSize: n(30) },
  signedInContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  smallLabel: { fontSize: n(16), paddingHorizontal: n(22) },
  email: {
    fontSize: n(24),
    paddingHorizontal: n(22),
    paddingTop: n(4),
    paddingBottom: n(18),
  },
  row: { paddingHorizontal: n(22), paddingVertical: n(16) },
  selectorLabel: { fontSize: n(16) },
  selectorValue: { fontSize: n(24), paddingTop: n(4) },
  signOutWrapper: { alignItems: "center", paddingBottom: n(28) },
  confirmText: { fontSize: n(24), letterSpacing: n(5) },
  formContainer: { flex: 1 },
  field: { paddingHorizontal: n(22), paddingTop: n(20) },
  fieldLabel: { fontSize: n(16), paddingBottom: n(4) },
  input: {
    fontSize: n(24),
    fontFamily: "PublicSans-Regular",
    paddingVertical: n(4),
    paddingLeft: 0,
    borderBottomWidth: 3,
  },
  errorText: { fontSize: n(16), paddingHorizontal: n(22), paddingTop: n(14) },
  signInBtn: { paddingHorizontal: n(22), paddingTop: n(28) },
  rowDisabled: { opacity: 0.4 },
  signInText: { fontSize: n(24), letterSpacing: n(3) },
});
