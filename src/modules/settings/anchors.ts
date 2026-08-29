/**
 * Section anchors, so any module can link straight at the setting it needs.
 * One home for configuration, many doors into it.
 */
export const SETTINGS_ANCHORS = {
  expenseCategories: 'kategori-pengeluaran',
  accounts: 'akun',
  members: 'anggota',
  household: 'rumah',
} as const

export const settingsHref = (
  anchor: (typeof SETTINGS_ANCHORS)[keyof typeof SETTINGS_ANCHORS],
) => `/settings#${anchor}`
