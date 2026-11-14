# Credits

- **Qur'an text** (Ayat al-Kursi and Surahs 112–114): Tanzil Uthmani text, from the Tanzil Project (https://tanzil.net), fetched through https://api.alquran.cloud. The only change made is a mechanical one: the opening *bismillah* is split off the first verse of each surah so it can be shown on its own line (see `scripts/build-adhkar.py`). The Tanzil text is distributed under its own terms (attribution required, text must not be altered); check https://tanzil.net/docs/Text_License before you redistribute it.
- **Adhkar** (Arabic and English): Hisn al-Muslim, chapter 27, from https://www.hisnmuslim.com. The scripts in `scripts/` clean it up mechanically (see the notes at the top of `scripts/build-adhkar.py`). The source files are kept in `scripts/sources/`.
- **Prayer-time maths:** [adhan](https://github.com/batoulapps/adhan-js) (MIT).
- **Fonts**, installed from npm and bundled into the builds: [Inter](https://rsms.me/inter/) and [Scheherazade New](https://software.sil.org/scheherazade/), both under the SIL Open Font License.
- **App shell:** [Capacitor](https://capacitorjs.com) (MIT). **Icons:** [Lucide](https://lucide.dev) (ISC). **UI:** React, Vite, Vitest (MIT).
- The app icon, splash screen and status-bar icon are drawn for this project.
