# Reminders

A reminders app for the Light Phone III.

Organize tasks into lists, add due dates and times, check things off as you go, and get notified when it matters.

Built with [vandamd's light-template](https://github.com/vandamd/light-template) — a community-made Expo template for building LightOS-style apps for the Light Phone III.

![Reminders screenshots](assets/images/screenshots.png)

---

## Features

* Organize tasks into multiple lists
* Add due dates and times to any task
* Today view shows only tasks due today
* Subtasks on any task, including when adding a new task
* Check off tasks and subtasks with a tap
* Completed tasks move to a collapsible group at the bottom
* Long-press a list to rename, reorder, clear completed, or delete it
* Notifications for tasks with a set time
* Daily bundled notification for today's untimed tasks
* Custom LightOS-style date and time pickers
* Respects LightOS theme (black/white mode)

---

## Building

This project uses [Expo](https://expo.dev) and [EAS Build](https://docs.expo.dev/build/introduction/).

### Prerequisites

* [Bun](https://bun.sh)
* [EAS CLI](https://docs.expo.dev/build/setup/)
* An Expo account

### Steps

```
bun install
eas login
eas build --platform android --profile preview
```

EAS will build the APK in the cloud and provide a download link.

---

## Installing on Light Phone III

1. Download the APK from the latest [GitHub Release](https://github.com/im360noscope/reminders-tool/releases)
2. On your Light Phone III, enable installing from unknown sources
3. Transfer and install the APK, or use [Obtainium](https://github.com/ImranR98/Obtainium) to manage updates automatically

---

## Credits

* [vandamd](https://github.com/vandamd) — [light-template](https://github.com/vandamd/light-template), the community Expo template this app is built on
* [The Light Phone](https://www.thelightphone.com) — for building a phone worth making apps for
