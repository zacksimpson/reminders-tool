# Mac Development Setup — Reminders Tool

Migrating from Windows to macOS 26. Follow these steps in order to get a fully working dev environment that matches the Windows setup.

**Repo:** https://github.com/zacksimpson/reminders-tool  
**Current version:** v1.2.3 (production)  
**Target device:** Light Phone III (Android)

---

## 1. Install Homebrew

Homebrew is the package manager for macOS — install it first.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After install, follow the printed instructions to add Homebrew to your PATH (required on Apple Silicon). It will look something like:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

---

## 2. Install Core Tools

```bash
brew install bun git gh
```

Verify:
```bash
bun --version    # expect 1.x
git --version
gh --version
```

---

## 3. Install Java JDK 17

Expo SDK 55 / React Native 0.83 requires JDK 17. Install Temurin (Eclipse Adoptium):

```bash
brew install --cask temurin@17
```

Set `JAVA_HOME` in your shell profile. Add this to `~/.zshrc`:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

Then reload:

```bash
source ~/.zshrc
java -version   # should print: openjdk version "17.x.x"
```

---

## 4. Install Android Studio

```bash
brew install --cask android-studio
```

Open Android Studio and complete the setup wizard:
- Accept licenses
- Install **Android SDK** (API level 35 recommended)
- Install **Android SDK Build-Tools** (latest)
- Install **Android SDK Platform-Tools** (includes `adb`)

After setup, confirm the SDK path: **Android Studio → Settings → Languages & Frameworks → Android SDK**. It should be `~/Library/Android/sdk`.

Add Android tools to your PATH. Add these lines to `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
```

Then reload:

```bash
source ~/.zshrc
adb --version   # confirms platform-tools are in PATH
```

---

## 5. Install EAS CLI

EAS is used for cloud builds and production releases.

```bash
bun install -g eas-cli
eas --version   # should print 15.x or later
```

---

## 6. Install Claude Code CLI (optional but recommended)

If you want to continue working with Claude Code in the terminal:

```bash
npm install -g @anthropic-ai/claude-code
```

> Note: Claude Code conversation history is local to each machine — Windows sessions won't be visible on Mac. Use the `MAC_SETUP.md` itself as the handoff, and paste the **New Session Starter** block at the bottom into your first Mac session.

---

## 7. Authenticate GitHub CLI

```bash
gh auth login
```

Choose **GitHub.com** → **HTTPS** → **Login with a web browser**. Complete in browser.

Verify:
```bash
gh auth status
```

---

## 8. Clone the Repository

```bash
mkdir -p ~/Dev
cd ~/Dev
git clone https://github.com/zacksimpson/reminders-tool.git reminders
cd reminders
```

---

## 9. Install Dependencies

```bash
bun install
```

This reads `bun.lock` and installs exact dependency versions.

---

## 10. Verify Everything

Run through this checklist:

```bash
bun --version          # 1.x
java -version          # openjdk 17.x.x
adb --version          # Android Debug Bridge
eas --version          # 15.x or later
gh auth status         # Logged in to github.com
bun run check          # Biome lint — should pass with 0 errors
```

---

## 11. Connect Your Light Phone III

1. Enable **Developer Options** on your Light Phone (Settings → About → tap Build Number 7 times)
2. Enable **USB Debugging** in Developer Options
3. Connect via USB
4. Accept the "Allow USB debugging?" prompt on the phone

Verify the device is visible:
```bash
adb devices
# List of devices attached
# XXXXXXXX    device
```

---

## 12. Run the Dev Build

```bash
bun run dev
```

This builds a debug APK, installs it on your connected device, and starts the Metro bundler with hot reload. First build will take a few minutes as Gradle compiles everything.

> **Note:** Having both a debug APK and a production APK installed simultaneously causes data isolation issues. Keep only one installed at a time.

---

## 13. EAS Login

EAS builds are triggered by git tags but you may also want to be logged in locally:

```bash
eas login
# Log in with your Expo account (zacksimpson)
```

---

## Verification Summary

| Tool | Expected Output |
|------|----------------|
| `bun --version` | `1.x.x` |
| `java -version` | `openjdk version "17.x.x"` |
| `adb devices` | Your Light Phone listed |
| `eas --version` | `15.x` or later |
| `gh auth status` | `Logged in to github.com account zacksimpson` |
| `bun run check` | No errors (Biome lint passes) |

---

## New Claude Session Starter

Paste this into your **first Claude Code message on Mac** to restore full project context:

---

> I'm resuming development on my Reminders Tool project — a LightOS task manager app for the Light Phone III, built with React Native / Expo 55. The project is at **v1.2.3** (just shipped to production). I've migrated from Windows to macOS for development. The repo is cloned at `~/Dev/reminders`.
>
> **Read `CLAUDE.md` and `MAC_SETUP.md` in the project root first** — they contain all design rules, component patterns, and project context you'll need. Key things to know up front:
> - Always use `n()` for every dimension value
> - Always use `HapticPressable` instead of TouchableOpacity/TouchableWithoutFeedback
> - No gray colors, no dividers anywhere
> - Completed items use `opacity: 0.4`, never strikethrough
> - Package manager is `bun` — use `bun install`, `bun run check`, `bun run fix`
> - Don't push `v*` git tags unless intentionally triggering an EAS cloud build (costs credits)
>
> The last session completed a Staff Engineer refactor (hooks extraction, shared utilities, duplicate logic removal) and shipped v1.2.3. The next identified improvement is extracting a shared `TaskRow` component — `app/list/[id].tsx` and `app/(tabs)/today.tsx` have nearly identical row implementations.
