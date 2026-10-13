# Reminders
> This branch (`tool-library`) is the version submitted to the Light Tool Library.

Organize tasks into lists with due dates, times, subtasks, and recurring reminders. A Today view shows what's due, finished tasks tuck away at the bottom, and optional account sync keeps your phone and desktop in step.

---

## Data and privacy

Everything is stored on the phone and the tool works fully offline. Nothing leaves the device unless you choose to sign in to sync.

If you sign in, your email address and password go to Google Firebase Authentication, and your lists, tasks and settings are stored in a Firestore database in a Firebase project run by the developer (same account as the Reminders web app). Each account can only read its own data. Syncing runs when the tool opens and about every 30 minutes while you are signed in and online. Signing out stops syncing.

There is no analytics, tracking, or advertising.

---

## Support

If any of my tools have been useful to you, I'd love to hear from you! Feel free to reach out [here](mailto:zacksimpson24@gmail.com). Another way to support is to [consider sponsoring](https://github.com/sponsors/zacksimpson). Either way, it means a lot!

---

## Credits

* [The Light Phone](https://www.thelightphone.com): for building a phone worth making tools for
