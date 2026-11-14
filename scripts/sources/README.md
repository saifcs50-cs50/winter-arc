# Adhkar sources

Downloaded 2026-09-29. `scripts/build-adhkar.py` turns these into `src/data/adhkar.json`; no Arabic is typed by hand.

| File | Source |
|---|---|
| `hisnmuslim-ar-27.json` | Hisn al-Muslim, chapter 27 "أذكار الصباح والمساء" — https://www.hisnmuslim.com/api/ar/27.json |
| `hisnmuslim-en-27.json` | Same chapter, English — https://www.hisnmuslim.com/api/en/27.json |
| `tanzil-uthmani-*.json` | Qur'an text (Tanzil Uthmani) via https://api.alquran.cloud/v1/{ayah,surah}/…/quran-uthmani |
| `crosscheck-azkar.json` | Not included (no licence to redistribute it). Optional: an independent morning/evening azkar dataset (github.com/nawafalqari/azkar-api) that `build-adhkar.py` uses only to cross-check the evening wording if you download it to this folder under that name. Without it the script skips the check. |
