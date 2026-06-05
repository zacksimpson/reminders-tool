# Reminders Tool — Claude Project Context

## Project Overview
A LightOS reminders/task manager app for the **Light Phone III**. Built as a native Android app using React Native / Expo. Android only — no iOS target. The app is minimal and monochromatic to match the Light Phone aesthetic.

**GitHub:** https://github.com/zacksimpson/reminders-tool  
**Working directory:** `~/Dev/reminders`  
**Primary branch:** `main`

---

## Tech Stack
- **React Native** 0.83.4 + **Expo** ~55
- **Expo Router** (file-based routing)
- **TypeScript**
- **Bun** (package manager — use `bun install`, not npm/yarn)
- **react-native-svg** for all SVG icons (`Svg`, `Path`, `Circle`)
- **AsyncStorage** for all data persistence
- **EAS Build** for production/preview APKs
- **Biome / Ultracite** for linting (`bun run check` / `bun run fix`)
- **PublicSans-Regular** and **PublicSans-Thin** fonts

---

## Key Files

| File | Purpose |
|------|---------|
| `app/(tabs)/index.tsx` | Lists tab — shows all lists |
| `app/(tabs)/today.tsx` | Today tab — tasks due today + overdue |
| `app/(tabs)/add.tsx` | Add tab — wraps TaskForm |
| `app/(tabs)/settings.tsx` | Settings tab |
| `app/list/[id].tsx` | List detail — tasks within a list |
| `app/task/[id].tsx` | Edit task screen |
| `components/TaskForm.tsx` | Add task form (used by Add tab and AddTaskModal) |
| `components/TaskCheckbox.tsx` | SVG circle checkbox (ring + fill when checked) |
| `components/ToggleSwitch.tsx` | Toggle with optional `description` prop for subtitle |
| `components/HapticPressable.tsx` | Pressable with haptics, `android_disableSound={true}` |
| `components/AddTaskModal.tsx` | Modal wrapper around TaskForm |
| `components/SwipeBackContainer.tsx` | Swipe-from-left gesture to go back |
| `contexts/RemindersContext.tsx` | All app data (lists, tasks, settings) + persistence |
| `hooks/useScrollIndicator.ts` | Custom scroll indicator logic + base styles |
| `utils/scaling.ts` | `n()` scaling utility — use for ALL dimensions |
| `app/settings/today-view.tsx` | Show Overdue toggle |

---

## Scaling
**Always use `n()` for every dimension** — sizes, padding, margin, font sizes, border widths. This scales values to the device screen. Never use raw numbers for layout values.

```ts
import { n } from "@/utils/scaling";
paddingHorizontal: n(22)
fontSize: n(30)
```

---

## Design Rules (strict)

- **No gray** — all text and UI elements are white on black (or black on white when `invertColors` is true). Never use `dimColor` (`#555555` / `#AAAAAA`) for visible text.
- **No dividers** — no `borderBottomWidth`, `borderTopWidth`, or separator Views between list items, settings rows, or anywhere else.
- **Completed items**: use `opacity: 0.4` — never strikethrough (`textDecorationLine: "line-through"`).
- **Placeholders and cursors**: use `textColor`, not `dimColor`. Always set `cursorColor={textColor}` and `selectionColor={textColor}` on TextInputs.
- **No native TextInput left padding** on Android: always add `paddingLeft: 0` to TextInput styles to override Android's default offset.
- **Fonts**: `fontFamily: "PublicSans-Regular"` for body text. Only use Thin for specific lightweight contexts.
- Standard horizontal padding: `n(22)` on most screens.

---

## Component Patterns

### HapticPressable
Use instead of `TouchableOpacity` or `TouchableWithoutFeedback` everywhere. It sets `android_disableSound={true}` which prevents the Android system click sound. **Never use `TouchableWithoutFeedback`** — it plays audible click sounds.

### Keyboard Dismissal
Use `keyboardDismissMode="on-drag"` on ScrollViews. Do not wrap in `TouchableWithoutFeedback` to dismiss keyboard.

Always set `keyboardShouldPersistTaps="handled"` on ScrollViews that contain interactive elements.

### Custom Scroll Indicator
All scrollable screens use a custom scroll indicator (not the native one). Use `useScrollIndicator` hook + `scrollIndicatorBaseStyles` from `hooks/useScrollIndicator.ts`. The scroll wrapper uses `flexDirection: "row"` to place the indicator track alongside the ScrollView. Track is `position: "absolute"`, `right: n(18)`. Task rows need `paddingRight: n(32)` to avoid overlap with the indicator.

### SVG Icons
Import from `react-native-svg`:
```ts
import Svg, { Path, Circle } from "react-native-svg";
```

### ToggleSwitch
Supports an optional `description` prop for subtitle text below the label (matches LightOS settings pattern):
```tsx
<ToggleSwitch
  label="Show Overdue"
  description="indicated with *"
  value={...}
  onValueChange={...}
/>
```

### TaskCheckbox
SVG-based circle checkbox. Default size `n(20)`. Uses `paddingHorizontal: n(14)` as hit area. Ring path + filled circle when checked.

---

## Navigation & Data Flow
- Expo Router file-based routing
- All data lives in `RemindersContext` — lists, tasks, settings all persisted to AsyncStorage
- `addTask`, `updateTask`, `deleteTask`, `toggleTask` etc. are callbacks from the context
- List view filters: `tasks.filter((t) => t.listId === id)`
- Tasks store `listId` (string), `date` (YYYY-MM-DD), `time`, `recurrence`, `subtasks[]`, `completed`, `order`

---

## Settings
| Setting | Key | Default |
|---------|-----|---------|
| Default List | `defaultListId` | `"inbox"` |
| After Quick Add | `afterAddBehavior` | `"toast"` |
| Add Position | `addPosition` | `"bottom"` |
| Show Overdue | `showOverdue` | `true` |

---

## Build & Release

### Dev (hot reload)
```
bun run dev
```
Builds debug APK, installs on connected device, starts Metro server. Phone must be connected via USB (or same WiFi after first install).

### Production / Beta Release
Triggered by pushing a `v*` tag to GitHub — runs GitHub Actions → EAS cloud build.

- Tag contains `"beta"` → `preview` EAS profile → APK output → GitHub **prerelease**
- No `"beta"` → `production` EAS profile → GitHub release

```bash
# Bump versions in app.json and package.json first, then:
git add app.json package.json
git commit -m "Bump version to x.x.x"
git push
git tag vX.X.X
git push origin vX.X.X
```

**EAS credits are limited** — don't push `v*` tags unless intentionally triggering a build.

CI uses `bun install --frozen-lockfile` — always commit `bun.lock` after changing dependencies.

### eas.json profiles
- `preview`: APK build (for beta/testing)
- `production`: AAB/release build (arm64-v8a)

---

## Do's and Don'ts

### Do
- Use `n()` for every dimension
- Use `HapticPressable` for all interactive elements
- Use `keyboardDismissMode="on-drag"` for keyboard dismissal on scroll views
- Add `paddingLeft: 0` to TextInput styles to fix Android default padding
- Apply `opacity: 0.4` for completed/dimmed states
- Keep Add Task and Edit Task screens in parity with each other
- Set `cursorColor` and `selectionColor` to `textColor` on all TextInputs
- Use `useRef` to avoid blur/onPress race conditions when saving inputs

### Don't
- Don't use gray (`#555`, `#AAA`, `dimColor`) for any visible text or UI
- Don't use dividers or separators anywhere
- Don't use `TouchableWithoutFeedback` (causes audible system click sounds on Android)
- Don't use `textDecorationLine: "line-through"` for completed items
- Don't push `v*` git tags unless you want to trigger an EAS cloud build
- Don't commit the `android/` directory (it's generated, only build output dirs are gitignored)
- Don't use raw pixel values — always `n()`
- Don't add `opacity` to placeholder text — use actual `textColor`

---

## Known History & Context
- App is for the Light Phone III running LightOS — a minimalist Android-based OS
- Design language matches LightOS: white-on-black, no decoration, no color
- Inverted colors mode (black-on-white) is supported via `useInvertColors()` context
- The `android/` folder exists locally but is not tracked in git (regenerated via `expo prebuild`)
- Previous version history: 1.2.0 → 1.2.1 → 1.2.2 → 1.2.3-beta.1
- Two APKs installed simultaneously (debug + production) causes data isolation issues — keep only one installed at a time
