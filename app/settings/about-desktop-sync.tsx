import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

function InfoParagraph({ children }: { children: ReactNode }) {
  return <StyledText style={styles.paragraph}>{children}</StyledText>;
}

/**
 * One-off explainer, not a back-navigable detail screen: swipe-back is disabled and
 * there's no back chevron; a single bottom-pinned button is the only way out. Opened
 * from the Account screen.
 */
export default function AboutDesktopSyncScreen() {
  const { invertColors } = useInvertColors();
  const bg = invertColors ? "white" : "black";

  return (
    <SwipeBackContainer enabled={false} onSwipeBack={() => router.back()}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header headerTitle="About Desktop Sync" hideBackButton />

        <View style={styles.body}>
          <InfoParagraph>
            The Reminders tool can automatically sync with the web version so you can
            manage your tasks from anywhere.
          </InfoParagraph>
          <StyledText style={styles.paragraph}>
            To get started, create an account at{"\n"}
            <StyledText style={styles.underline}>
              reminders-tool.web.app
            </StyledText>
          </StyledText>
          <InfoParagraph>
            Then sign in to that same account here under Settings → Account.
          </InfoParagraph>
          <InfoParagraph>
            Automatic syncing happens whenever you open the app.
          </InfoParagraph>
        </View>

        <HapticPressable
          onPress={() => router.back()}
          style={styles.confirmBtnWrapper}
        >
          <StyledText style={styles.confirmText}>UNDERSTOOD</StyledText>
        </HapticPressable>
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, paddingHorizontal: n(22), paddingTop: n(20) },
  paragraph: { fontSize: n(20), lineHeight: n(28), marginBottom: n(18) },
  underline: { textDecorationLine: "underline" },
  confirmBtnWrapper: { alignItems: "center", paddingBottom: n(28) },
  confirmText: { fontSize: n(24), letterSpacing: n(5) },
});
