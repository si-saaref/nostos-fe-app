/**
 * Section anchors, so any module can link straight at the setting it needs.
 * One home for configuration, many doors into it.
 */
export const SETTINGS_ANCHORS = {
  expenseCategories: 'kategori-pengeluaran',
  incomeCategories: 'jenis-pemasukan',
  incomeTypes: 'jenis-pemasukan',
  accounts: 'akun',
  changeName: 'ubah-nama',
  changeEmail: 'profil',
  profile: 'profil',
  personalPreferences: 'preferensi-pribadi',
  members: 'anggota',
  householdAccounting: 'rumah',
  household: 'rumah',
} as const

export const settingsHref = (
  anchor: (typeof SETTINGS_ANCHORS)[keyof typeof SETTINGS_ANCHORS],
) => `/settings#${anchor}`
