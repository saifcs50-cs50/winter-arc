# Winter Arc

A 92-day habit tracker (1 October – 31 December 2026) with an Android app and a Mac app. The two sync over your local Wi-Fi (or the phone's hotspot) with no cloud and no account.

It was built around the five daily prayers plus bonus Islamic goals, so the full edition ("deen") includes prayer times, an adhkar reader and a tasbih counter. A second build, the "standard" edition, has none of the religious parts: it uses a wake-up alarm at a time you pick, and bonus goals you choose.

## What it does

- **Today:** a "core 5" set of rules decides whether a day counts (five prayers, 3+ hours of study, no Reels and social media under 60 minutes, 7+ hours of sleep, a workout). Bonus rules make the day greener but never decide whether it counts. Also: a night plan worked back from your wake-up time so you always get 7 hours, a workout plan with set logging and a rest timer, and a weight and mood log.
- **Arc:** a 92-day calendar, current and best streaks, and the three phases.
- **Review:** weekly or whole-arc charts, the most-missed rule, and Sunday notes.
- **Prayer times** are worked out on the device with [adhan](https://github.com/batoulapps/adhan-js), so no internet is needed. The default location is Mecca; see "Setting your location" below.
- **Android only:** reads social-app screen time through Android's usage access (nothing leaves the phone except the daily total that syncs to the Mac), and sets real alarm-clock alarms and reminders.
- **Sync:** each device keeps its own copy. Every field is stamped with the time it was written and the device that wrote it, and merging keeps the newest stamp per field, so both sides converge even after editing offline. The Mac runs a small hub on port 4747; the phone finds it on the network (Bonjour, then a scan of the local subnet) and you pair them once with an 8-letter code shown on the Mac.

## Setting your location

Prayer times are worked out for `PRAYER_LOCATION` in [`src/core/config.ts`](src/core/config.ts), which defaults to Mecca. Put your own city's name and coordinates there. Times are shown in the device's time zone. The calculation method (Karachi) and the Asr rule (Shafi'i) are set in [`src/core/prayer.ts`](src/core/prayer.ts); change them there if you follow a different method.

The arc's dates are fixed in [`src/core/dates.ts`](src/core/dates.ts).

## Build and run

You need Node.js 24.2 or newer (the hub runs TypeScript directly); this was developed on Node 25.

```sh
npm ci
npm test            # unit tests (Vitest)
npm run build       # type-check and build the web app into dist/
npm run dev         # dev server on http://localhost:5193, proxying /api to the hub
npm run hub         # the sync hub on http://localhost:4747 (serves dist/ too)
```

**Mac (needs macOS and the Xcode Command Line Tools; no Xcode):**

- `mac/install-hub.sh` installs the hub as a login service (launchd) that serves the built app, and `mac/build-app.sh` builds a native window around it. Remove the service with `mac/install-hub.sh --uninstall`.
- `mac/build-standalone.sh` builds a self-contained Mac app for the standard edition, with the hub built in (no Node needed), as a universal binary. `mac/build-standalone.sh --test-binary x86_64` builds just the hub; the contract test in `mac/Standalone/hub-contract.test.ts` then runs against it with `SWIFT_HUB_BIN=<path> npx vitest run mac/Standalone/hub-contract.test.ts`.

**Android (needs the Android SDK and JDK 21):**

- `npm run apk` builds the web app, syncs it into the Capacitor project and builds a debug APK. The script sets `JAVA_HOME` to Android Studio's bundled JDK on macOS; change it in `package.json` if yours lives elsewhere.
- `npm run apk:standard` builds the standard edition as a separate app (`com.winterarc.standard`), so it installs next to the full one. `npm run build:standard` builds the standard edition for the web.
- `scripts/check-standard-release.sh` checks that built standard-edition files contain no religious wording.

## What was tested

The unit tests (89) and the web build pass, and the Swift hub's contract tests (7) pass against the Node hub's behaviour. The Android app and the Mac app bundles were not rebuilt or run while preparing this repository, so treat those two builds as untested here.

## Notes

- Sync is plain HTTP on your local network, protected only by the pairing code (with a rate limit on wrong guesses). Use it on networks you trust.
- The hub's `/api/hello` answers anyone on the network with the app name and the Mac's host name, which is how the phone recognises it.
- Your data is stored on the devices: in the app's local storage, and on the Mac in `~/Library/Application Support/WinterArc` (the standalone app uses `WinterArc Standard`).

## Tech

TypeScript, React, Vite and Vitest for the app. Capacitor and a small Java plugin for Android. Node (or a Swift port of the same hub) and Swift/WebKit for the Mac side.

## Licence and credits

MIT, see [LICENSE](LICENSE). Text sources, fonts and libraries are credited in [CREDITS.md](CREDITS.md).
