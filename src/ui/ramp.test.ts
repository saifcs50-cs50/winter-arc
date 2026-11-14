import { expect, test } from 'vitest'
import { COMPLETION_RAMP, completionColor } from './ramp.ts'

test('empty days use the surface step and full days the brightest green', () => {
  expect(completionColor(0)).toBe(COMPLETION_RAMP[0])
  expect(completionColor(1)).toBe(COMPLETION_RAMP[6])
})

test('every partial day gets a middle step that never decreases', () => {
  const steps = [0.01, 0.2, 0.4, 0.6, 0.8, 0.99].map((f) => COMPLETION_RAMP.indexOf(completionColor(f) as (typeof COMPLETION_RAMP)[number]))
  expect(steps.every((s) => s >= 1 && s <= 5)).toBe(true)
  expect([...steps].sort((a, b) => a - b)).toEqual(steps)
})
