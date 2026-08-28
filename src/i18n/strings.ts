/**
 * Minimal i18n. PRODUCT.md makes two languages a durable constraint, so no
 * component may hold a literal user-facing string. Indonesian is the default;
 * English is a first-class target, not a fallback.
 *
 * Kept deliberately dependency-free: the dictionary is a typed object and
 * `t()` does positional interpolation with {name} placeholders.
 */
export const LANGS = [
  { id: 'id', label: 'Bahasa Indonesia' },
  { id: 'en', label: 'English' },
] as const

export type Lang = (typeof LANGS)[number]['id']

export const DEFAULT_LANG: Lang = 'id'
export const LANG_STORAGE_KEY = 'nostos.lang'

const DICT = {
  id: {
    'nav.expenses': 'Pengeluaran',
    'nav.dashboard': 'Beranda',
    'nav.income': 'Pemasukan',
    'nav.savings': 'Investasi & Tabungan',
    'nav.plan': 'Rencana',
    'nav.members': 'Anggota',
    'nav.settings': 'Pengaturan',
    'nav.soon': 'Segera',
    'nav.soonHint': 'Belum tersedia',
    'nav.household': 'Rumah',
    'nav.menu': 'Menu utama',

    'count.title': 'Hitungan',
    'count.total': 'Total keluar',
    'count.previous': 'Bulan lalu',
    'count.entries': 'Entri',
    'count.yours': 'Dibayar olehmu',
    'count.perDay': '{n} per hari',
    'count.avg': 'rata {amount}',
    'count.vsPrevious': '{pct} vs {month}',
    'count.shareOfTotal': '{pct} dari total',
    'count.scopeAll': 'Semua {what}',
    'count.categories': 'kategori',
    'count.members': 'anggota',

    'filter.search': 'Cari nama pengeluaran…',
    'filter.category': 'Kategori',
    'filter.method': 'Metode',
    'filter.paidBy': 'Dibayar oleh',
    'filter.clear': 'Hapus filter',
    'filter.allCategories': 'Semua kategori',

    'rail.month': 'Bulan',
    'rail.upTo': 's/d {date}',
    'rail.jumpTo': 'Lompat ke {date}',
    'rail.legend': 'Panjang bilah = belanja hari itu',

    'tape.entriesShort': '{n} entri',
    'tape.empty.title': 'Belum ada pengeluaran',
    'tape.empty.body':
      'Catat pengeluaran pertama rumah ini. Setiap entri menyimpan siapa membayar, untuk apa, dan kapan.',
    'tape.empty.filtered': 'Tidak ada yang cocok dengan filter ini.',
    'tape.error': 'Gagal memuat pengeluaran.',
    'tape.retry': 'Coba lagi',
    'tape.loading': 'Memuat pengeluaran…',

    'plate.category': 'Kategori',
    'plate.method': 'Metode',
    'plate.paidBy': 'Dibayar oleh',
    'plate.recordedBy': 'Dicatat oleh',
    'plate.adminOnly': 'Hanya admin',
    'plate.edit': 'Ubah',
    'plate.delete': 'Hapus',
    'plate.close': 'Tutup',
    'plate.open': 'Buka rincian {name}',
    'plate.historyKept': 'Riwayat tersimpan — tidak ada yang dihapus.',
    'plate.neverEdited': 'belum pernah diubah',

    'baseline.title': 'Normalnya berapa?',
    'baseline.usual': 'Biasanya {range} untuk kategori ini di rumah ini.',
    'baseline.higher': '{factor}× lebih tinggi',
    'baseline.lower': '{factor}× lebih rendah',
    'baseline.enoughToAsk': 'cukup untuk ditanyakan, belum tentu salah',
    'baseline.cheapest': 'termurah sejauh ini',
    'baseline.bigForCategory': 'besar untuk {category}',
    'baseline.noHistory': 'Belum pernah dicatat sebelumnya di rumah ini.',
    'baseline.notEnough': 'Belum cukup riwayat untuk membandingkan.',

    'form.title': 'Catat pengeluaran',
    'form.name': 'Nama pengeluaran',
    'form.amount': 'Jumlah',
    'form.category': 'Kategori',
    'form.method': 'Metode pembayaran',
    'form.date': 'Tanggal bayar',
    'form.paidBy': 'Dibayar oleh',
    'form.choose': 'Pilih…',
    'form.submit': 'Catat',
    'form.saving': 'Menyimpan…',
    'form.cancel': 'Batal',
    'form.err.name': 'Nama wajib diisi',
    'form.err.amount': 'Jumlah wajib diisi',
    'form.err.positive': 'Harus lebih dari nol',
    'form.err.category': 'Kategori wajib dipilih',
    'form.err.method': 'Metode wajib dipilih',
    'form.err.date': 'Tanggal wajib diisi',
    'form.err.future': 'Tidak boleh tanggal yang akan datang',
    'action.record': 'Catat',
    'action.recordLong': 'Catat pengeluaran',
    'theme.label': 'Tema',
    'lang.label': 'Bahasa',
  },
  en: {
    'nav.expenses': 'Expenses',
    'nav.dashboard': 'Dashboard',
    'nav.income': 'Income',
    'nav.savings': 'Investments & Savings',
    'nav.plan': 'Plan',
    'nav.members': 'Members',
    'nav.settings': 'Settings',
    'nav.soon': 'Soon',
    'nav.soonHint': 'Not available yet',
    'nav.household': 'Household',
    'nav.menu': 'Main menu',

    'count.title': 'The count',
    'count.total': 'Total spent',
    'count.previous': 'Last month',
    'count.entries': 'Entries',
    'count.yours': 'Paid by you',
    'count.perDay': '{n} per day',
    'count.avg': 'avg {amount}',
    'count.vsPrevious': '{pct} vs {month}',
    'count.shareOfTotal': '{pct} of total',
    'count.scopeAll': 'All {what}',
    'count.categories': 'categories',
    'count.members': 'members',

    'filter.search': 'Search expense name…',
    'filter.category': 'Category',
    'filter.method': 'Method',
    'filter.paidBy': 'Paid by',
    'filter.clear': 'Clear filters',
    'filter.allCategories': 'All categories',

    'rail.month': 'Month',
    'rail.upTo': 'through {date}',
    'rail.jumpTo': 'Jump to {date}',
    'rail.legend': 'Bar length = that day’s spending',

    'tape.entriesShort': '{n} entries',
    'tape.empty.title': 'No expenses yet',
    'tape.empty.body':
      'Record this household’s first expense. Every entry keeps who paid, what for, and when.',
    'tape.empty.filtered': 'Nothing matches these filters.',
    'tape.error': 'Could not load expenses.',
    'tape.retry': 'Try again',
    'tape.loading': 'Loading expenses…',

    'plate.category': 'Category',
    'plate.method': 'Method',
    'plate.paidBy': 'Paid by',
    'plate.recordedBy': 'Recorded by',
    'plate.adminOnly': 'Admins only',
    'plate.edit': 'Edit',
    'plate.delete': 'Delete',
    'plate.close': 'Close',
    'plate.open': 'Open details for {name}',
    'plate.historyKept': 'History is kept — nothing is destroyed.',
    'plate.neverEdited': 'never edited',

    'baseline.title': 'What’s normal?',
    'baseline.usual': 'Usually {range} for this category in this household.',
    'baseline.higher': '{factor}× higher',
    'baseline.lower': '{factor}× lower',
    'baseline.enoughToAsk': 'enough to ask about, not necessarily wrong',
    'baseline.cheapest': 'cheapest so far',
    'baseline.bigForCategory': 'large for {category}',
    'baseline.noHistory': 'Never recorded in this household before.',
    'baseline.notEnough': 'Not enough history to compare yet.',

    'form.title': 'Record an expense',
    'form.name': 'Expense name',
    'form.amount': 'Amount',
    'form.category': 'Category',
    'form.method': 'Payment method',
    'form.date': 'Date paid',
    'form.paidBy': 'Paid by',
    'form.choose': 'Choose…',
    'form.submit': 'Record',
    'form.saving': 'Saving…',
    'form.cancel': 'Cancel',
    'form.err.name': 'Name is required',
    'form.err.amount': 'Amount is required',
    'form.err.positive': 'Must be greater than zero',
    'form.err.category': 'Category is required',
    'form.err.method': 'Payment method is required',
    'form.err.date': 'Date is required',
    'form.err.future': 'Cannot be a future date',
    'action.record': 'Record',
    'action.recordLong': 'Record an expense',
    'theme.label': 'Theme',
    'lang.label': 'Language',
  },
} as const

export type StringKey = keyof (typeof DICT)['id']

export const translate = (
  lang: Lang,
  key: StringKey,
  vars?: Record<string, string | number>,
): string => {
  const template: string = DICT[lang][key] ?? DICT[DEFAULT_LANG][key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

export const isLang = (value: unknown): value is Lang =>
  LANGS.some((lang) => lang.id === value)

export const readStoredLang = (): Lang => {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY)
    return isLang(stored) ? stored : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}
