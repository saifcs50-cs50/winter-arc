/**
 * Two builds share one codebase:
 * - `deen` is the full edition: salah, adhkar, Qur'an, Tahajjud alarm before Fajr.
 * - `standard` has no religious goals, a wake-up alarm at a time the user sets, and bonus goals they pick.
 * Choose at build time with VITE_EDITION=standard.
 */
export type Edition = 'deen' | 'standard'

export function editionFrom(value: string | undefined): Edition {
  return value === 'standard' ? 'standard' : 'deen'
}

export const EDITION: Edition = editionFrom(import.meta.env?.VITE_EDITION)
