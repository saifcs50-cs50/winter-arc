import { expect, test } from 'vitest'
import adhkar from '../../data/adhkar.json'
import { attachWaqfMarks } from './AdhkarReader.tsx'

const kursi = (adhkar as { morning: { items: { surahs?: { verses: string[] }[] }[] } }).morning.items[0].surahs![0].verses[0]
const strip = (s: string) => s.replace(/\s/g, '')

test('attaching waqf marks only removes the space before them', () => {
  const joined = attachWaqfMarks(kursi)
  expect(strip(joined)).toBe(strip(kursi))
  expect(joined).not.toMatch(/ [ۖ-ۜ]/)
})

test('both sets stay within the 5 to 8 minute budget', () => {
  const sets = adhkar as unknown as Record<'morning' | 'evening', { minutes: number }>
  for (const set of [sets.morning, sets.evening]) {
    expect(set.minutes).toBeGreaterThanOrEqual(5)
    expect(set.minutes).toBeLessThanOrEqual(8)
  }
})
