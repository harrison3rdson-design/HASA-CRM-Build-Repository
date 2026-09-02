export const TIME_INCREMENT_HOURS = 0.5;

export function roundHoursUp(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Hours must be a non-negative number.");
  }
  if (value === 0) return 0;

  return Math.ceil(value / TIME_INCREMENT_HOURS - 1e-9) * TIME_INCREMENT_HOURS;
}
