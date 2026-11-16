# Winter Arc

I built Winter Arc to keep my study, workouts and the five daily prayers on track for 92 days, from 1 October to
31 December 2026. It has an Android app and a Mac app that sync over your local Wi-Fi or the phone's hotspot, with no
cloud and no account.

The full edition ("deen") is built around the five prayers and bonus Islamic goals, with prayer times, an adhkar
reader and a tasbih counter. The "standard" edition has none of the religious parts. It has a wake-up alarm at a time
you pick, and bonus goals you choose.

## Today, Arc and Review

On the Today screen, a "core 5" set of rules decides whether a day counts: five prayers, 3+ hours of study, no Reels
and social media under 60 minutes, 7+ hours of sleep, and a workout. Bonus rules make the day greener but never decide
it. Today also has a night plan worked back from your wake-up time so you always get 7 hours, a weight and mood log,
and in the full edition a workout plan with set logging and a rest timer.

Arc shows a 92-day calendar, current and best streaks, and the three phases. Review has weekly or whole-arc charts,
the most-missed rule, and Sunday notes.

On Android the app also reads social-app screen time through usage access, and sets real alarm-clock alarms and
reminders. Only the daily screen-time total leaves the phone, to sync with the Mac.

## Prayer times and location

Prayer times are worked out on the device with [adhan](https://github.com/batoulapps/adhan-js), with no internet
needed. They're calculated for `PRAYER_LOCATION` in [`src/core/config.ts`](src/core/config.ts), which defaults to
Mecca; put your own city's name and coordinates there. Times are shown in the device's time zone. If you follow a
different calculation method than Karachi, or a different Asr rule than Shafi'i, change them in
[`src/core/prayer.ts`](src/core/prayer.ts).

The arc's dates are fixed in [`src/core/dates.ts`](src/core/dates.ts).

## How the sync works

Each device keeps its own copy. Every field is stamped with the time it was written and the device that wrote it,
and a merge keeps the newest stamp per field, so both sides converge even after editing offline. The Mac runs a small
hub on port 4747. The phone finds it on the network (Bonjour, then a scan of the local subnet), and you pair them once
with an 8-letter code shown on the Mac.

The subnet scan used to be the only way, and on a network with a Wi-Fi extender it failed. It sent 500 probes at
once, about half of them over mobile data, and the probe to the Mac timed out even though the Mac was reachable.
Bonjour found it in 0.3 s. The scan now skips mobile-data interfaces and has a slower second pass.

## Build and run

You need Node.js 24.2 or newer, because the hub runs TypeScript directly. I developed it on Node 25.

```sh
npm ci
npm test            # unit tests (Vitest)
npm run build       # type-check and build the web app into dist/
npm run dev         # dev server on http://localhost:5193, proxying /api to the hub
npm run hub         # the sync hub on http://localhost:4747 (serves dist/ too)
```

### Mac

You need macOS and the Xcode Command Line Tools. Full Xcode isn't needed.

- `mac/install-hub.sh` installs the hub as a login service (launchd) that serves the built app, and `mac/build-app.sh`
  builds a native window around it. `mac/install-hub.sh --uninstall` removes the service.
- `mac/build-standalone.sh` builds a self-contained universal Mac app for the standard edition, with the hub built in,
  so it needs no Node. `mac/build-standalone.sh --test-binary x86_64` builds just the hub; the contract test in
  `mac/Standalone/hub-contract.test.ts` then runs against it with `SWIFT_HUB_BIN=<path> npx vitest run mac/Standalone/hub-contract.test.ts`.

### Android

You need the Android SDK and JDK 21.

- `npm run apk` builds the web app, syncs it into the Capacitor project and builds a debug APK. The script sets
  `JAVA_HOME` to Android Studio's bundled JDK on macOS; change it in `package.json` if yours lives elsewhere.
- `npm run apk:standard` builds the standard edition as a separate app (`com.winterarc.standard`) that installs next
  to the full one. `npm run build:standard` builds the standard edition for the web.
- `scripts/check-standard-release.sh` checks that built standard-edition files contain no religious wording.

## What was tested

The 89 unit tests and the web build pass, and the Swift hub passes the 7 contract tests written from the Node hub's
behaviour. I didn't rebuild or run the Android app or the Mac app bundles while preparing this repository, so treat
those two builds as untested here.

## Network and data

- Sync is plain HTTP on your local network, protected only by the pairing code (with a rate limit on wrong guesses).
  Use it on networks you trust.
- The hub's `/api/hello` answers anyone on the network with the app name and the Mac's host name, which is how the
  phone recognises it.
- Your data stays on the devices: in the app's local storage, and on the Mac in
  `~/Library/Application Support/WinterArc` (the standalone app uses `WinterArc Standard`).

## Tech

TypeScript, React, Vite and Vitest for the app. Capacitor and a small Java plugin for Android. Node (or a Swift port
of the same hub) and Swift/WebKit for the Mac side.

## Licence and credits

MIT, see [LICENSE](LICENSE). Text sources, fonts and libraries are credited in [CREDITS.md](CREDITS.md).
