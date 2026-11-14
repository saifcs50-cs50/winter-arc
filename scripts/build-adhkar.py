#!/usr/bin/env python3
"""Builds src/data/adhkar.json from the downloaded Hisn al-Muslim and Tanzil files.

Every Arabic string comes from a source file. The only edits are mechanical: strip the
book's (( )) quote marks and count notes, restore a few missing harakat (DIACRITIC_FIXES), write the Prophet's
salutation as ﷺ, and derive the evening wording from the morning text using the exact
substitutions Hisn al-Muslim itself gives in its [وإذا أمسى قال: ...] notes. The evening
results are then cross-checked letter-for-letter against an independent dataset.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'scripts' / 'sources'
OUT = ROOT / 'src' / 'data' / 'adhkar.json'

WORDS_PER_SECOND = 2.2  # a steady recitation pace, used only for the "about N min" estimate
MAX_SECONDS = 8 * 60


def load(name):
    data = json.loads((SRC / name).read_text(encoding='utf-8-sig'))
    return data


hisn_ar = list(load('hisnmuslim-ar-27.json').values())[0]
hisn_en = list(load('hisnmuslim-en-27.json').values())[0]


def nfc(text: str) -> str:
    """Canonical mark order (fatha/kasra before shadda), so typed substitutions match the source."""
    return unicodedata.normalize('NFC', text)


# Missing harakat in the Hisn al-Muslim web text, restored to the standard vowelling.
DIACRITIC_FIXES = [
    ('وَخَيرَ', 'وَخَيْرَ'),
    ('الشَّيطَانِ', 'الشَّيْطَانِ'),
    ('السّمَاءِ', 'السَّمَاءِ'),
    ('أَسْتَغيثُ', 'أَسْتَغِيثُ'),
    ('الذُّنوبَ', 'الذُّنُوبَ'),
    ('إلاَّ', 'إِلاَّ'),
]


def fix_diacritics(text):
    for old, new in DIACRITIC_FIXES:
        text = text.replace(nfc(old), nfc(new))
    return text


def clean_hisn(text):
    text = fix_diacritics(nfc(text))
    text = re.sub(r'\[[^\]]*\]', '', text)          # evening notes, handled separately
    text = re.sub(r'\(\([^)]*\)\)', lambda m: m.group(0)[2:-2], text)  # (( dua )) -> dua
    text = re.sub(r'\([^)]*\)', '', text)            # (ثلاثَ مرَّاتٍ) and similar count notes
    text = text.replace('صلى الله عليه وسلم', 'ﷺ')
    text = re.sub(r'\s+،', '،', text)
    text = re.sub(r'\s+', ' ', text).strip().rstrip('.').strip()
    return text


def clean_en(text):
    text = re.sub(r'\((one hundred|three|seven|four) times[^)]*\)', '', text)
    text = text.replace('The All-Seeing, The All-Knowing', 'the All-Hearing, the All-Knowing')
    text = text.replace('’(three times)', '')
    text = text.replace('Allaah', 'Allah').replace(' ,', ',')
    text = text.strip().strip('()‘’\'').strip()
    text = re.sub(r'\s+', ' ', text)
    return text


def tanzil_surah(n):
    ayahs = load(f'tanzil-uthmani-surah_{n}.json')['data']['ayahs']
    words = ayahs[0]['text'].split(' ')
    bismillah = ' '.join(words[:4])
    assert skeleton(bismillah) == 'بسماللهالرحمنالرحيم', f'surah {n} ayah 1 has no bismillah prefix'
    verses = [' '.join(words[4:])] + [a['text'] for a in ayahs[1:]]
    return {'bismillah': bismillah, 'verses': verses}


def replace_exact(text, old, new):
    old, new = nfc(old), nfc(new)
    assert old in text, f'expected to find: {old}'
    return text.replace(old, new)


def derive_evening(idx, morning):
    if idx == 2:
        text = replace_exact(morning, 'أَصْبَحْنَا وَأَصْبَحَ', 'أَمْسَيْنَا وَأَمْسَى')
        text = replace_exact(text, 'خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ', 'خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا')
        text = replace_exact(text, 'شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ', 'شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا')
        return text
    if idx == 3:
        text = replace_exact(morning, 'بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا', 'بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا')
        return replace_exact(text, 'النُّشُورُ', 'الْمَصِيرُ')
    return morning


EVENING_EN = {
    2: lambda en: en.replace('We have reached the morning', 'We have reached the evening')
    .replace('the good of this day and the good of what follows it', 'the good of this night and the good of what follows it')
    .replace('the evil of this day and the evil of what follows it', 'the evil of this night and the evil of what follows it'),
    3: lambda _en: 'O Allah, by Your leave we have reached the evening and by Your leave we have reached the morning, by Your leave we live and die and unto You is our return.',
}

MORNING_EN_OVERRIDES = {
    3: 'O Allah, by Your leave we have reached the morning and by Your leave we have reached the evening, by Your leave we live and die and unto You is our resurrection.',
}

# (hisn index, repeat, which sets) in reading order. Quran items come first as in the book.
DUAS = [
    (2, 1, 'both'),
    (3, 1, 'both'),
    (4, 1, 'both'),
    (11, 3, 'both'),
    (12, 3, 'both'),
    (13, 1, 'both'),
    (20, 1, 'morning'),
    (22, 3, 'evening'),
    (16, 100, 'both'),
]

TITLES = {
    2: 'The dominion belongs to Allah',
    3: 'By You we live',
    4: 'Sayyid al-Istighfar',
    11: 'In the name of Allah',
    12: 'Pleased with Allah as Lord',
    13: 'O Ever-Living',
    16: 'SubhanAllah wa bihamdihi',
    20: 'Beneficial knowledge',
    21: 'Istighfar',
    22: "Allah's perfect words",
}


def quran_items():
    istiadha = fix_diacritics(nfc(hisn_ar[0]['ARABIC_TEXT'].split('﴿')[0].strip()))
    assert skeleton(istiadha) == 'اعوذباللهمنالشيطانالرجيم', istiadha
    kursi = load('tanzil-uthmani-ayah_2_255.json')['data']['text']
    return [
        {
            'id': 'kursi',
            'kind': 'quran',
            'title': 'Ayat al-Kursi',
            'reference': 'Al-Baqarah 2:255',
            'repeat': 1,
            'preface': istiadha,
            'surahs': [{'name': 'Ayat al-Kursi', 'bismillah': None, 'verses': [kursi]}],
            'meaning': clean_en(hisn_en[0]['TRANSLATED_TEXT']),
        },
        {
            'id': 'quls',
            'kind': 'quran',
            'title': 'Al-Ikhlas · Al-Falaq · An-Nas',
            'reference': 'Surahs 112–114, three times',
            'repeat': 3,
            'preface': None,
            'surahs': [
                {'name': 'Al-Ikhlas', **tanzil_surah(112)},
                {'name': 'Al-Falaq', **tanzil_surah(113)},
                {'name': 'An-Nas', **tanzil_surah(114)},
            ],
            'meaning': 'Recite all three surahs, then tap. Do this three times.',
        },
    ]


def dua_item(idx, repeat, evening):
    morning = clean_hisn(hisn_ar[idx]['ARABIC_TEXT'])
    arabic = derive_evening(idx, morning) if evening else morning
    en = MORNING_EN_OVERRIDES.get(idx) or clean_en(hisn_en[idx]['TRANSLATED_TEXT'])
    if evening and idx in EVENING_EN:
        en = EVENING_EN[idx](en)
    assert int(hisn_ar[idx]['REPEAT']) in (repeat, 1), f'repeat mismatch at {idx}'
    return {
        'id': f'hisn-{idx}',
        'kind': 'dua',
        'title': TITLES[idx],
        'reference': f'Hisn al-Muslim #{idx + 1}',
        'repeat': repeat,
        'arabic': arabic,
        'meaning': en,
    }


def build_set(which):
    evening = which == 'evening'
    items = quran_items() + [dua_item(i, r, evening) for i, r, sets in DUAS if sets in ('both', which)]
    return items


ARABIC_MARKS = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭـ]')


def skeleton(text):
    text = text.replace('ﷺ', 'صلى الله عليه وسلم')
    text = ARABIC_MARKS.sub('', text)
    text = re.sub('[أإآٱ]', 'ا', text).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
    return re.sub(r'[^ء-ي]', '', text)


def crosscheck(evening_items):
    if not (SRC / 'crosscheck-azkar.json').exists():
        print('crosscheck-azkar.json not found: skipping the evening cross-check (see scripts/sources/README.md)')
        return []
    reference = load('crosscheck-azkar.json')['أذكار المساء']
    reference = reference[0] if isinstance(reference[0], list) else reference
    ref_skeletons = [skeleton(r['content']) for r in reference]
    problems = []
    for item in evening_items:
        if item['kind'] != 'dua':
            continue
        mine = skeleton(item['arabic'])
        if not any(mine == ref or mine in ref or ref in mine for ref in ref_skeletons):
            problems.append(item['title'])
    return problems


def seconds(items):
    total = 0
    for item in items:
        if item['kind'] == 'quran':
            words = sum(len(v.split()) for s in item['surahs'] for v in s['verses'])
            words += sum(4 for s in item['surahs'] if s['bismillah'])
            words += len((item['preface'] or '').split())
        else:
            words = len(item['arabic'].split())
        total += words * item['repeat'] / WORDS_PER_SECOND
    return round(total)


def main():
    morning = build_set('morning')
    evening = build_set('evening')
    problems = crosscheck(evening)
    for label, items in (('morning', morning), ('evening', evening)):
        secs = seconds(items)
        print(f'{label}: {len(items)} items, about {secs / 60:.1f} min')
        if secs > MAX_SECONDS:
            sys.exit(f'{label} set is over 8 minutes')
    if problems:
        sys.exit(f'evening wording does not match the cross-check source: {problems}')
    istighfar = dua_item(21, 100, False)
    out = {
        'source': 'Hisn al-Muslim ch. 27 (hisnmuslim.com); Qur\'an text: Tanzil Uthmani',
        'istighfar': {'arabic': istighfar['arabic'], 'meaning': istighfar['meaning'], 'reference': istighfar['reference']},
        'morning': {'minutes': round(seconds(morning) / 60), 'items': morning},
        'evening': {'minutes': round(seconds(evening) / 60), 'items': evening},
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
