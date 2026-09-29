/** True for a finite number (or numeric string) within [min, max]. Zero is a valid economy. */
export function inRange(value: unknown, min: number, max: number): boolean {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
}
