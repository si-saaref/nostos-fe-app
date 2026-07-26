export const isNonEmpty = (value: string): boolean => value.trim().length > 0

export const isPositiveNumber = (value: number): boolean =>
  Number.isFinite(value) && value > 0
