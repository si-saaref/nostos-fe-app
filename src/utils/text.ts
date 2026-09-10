/**
 * A name as the household will read it back. Only the first letter is touched:
 * "tarik tunai" becomes "Tarik tunai", and "BANK BSI" keeps its own shouting.
 */
export const capitalizeFirst = (value: string): string =>
  value.charAt(0).toLocaleUpperCase() + value.slice(1)
