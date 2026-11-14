/** Completion colour: one green hue, dark (near the surface) to bright, so fuller days glow greener. */
export const COMPLETION_RAMP = ['#16223b', '#143a33', '#155238', '#1a6e40', '#238b49', '#2fa955', '#4cd070'] as const

export function completionColor(fraction: number): string {
  if (fraction <= 0) return COMPLETION_RAMP[0]
  if (fraction >= 1) return COMPLETION_RAMP[COMPLETION_RAMP.length - 1]
  const inner = COMPLETION_RAMP.length - 2
  return COMPLETION_RAMP[1 + Math.min(inner - 1, Math.floor(fraction * inner))]
}
