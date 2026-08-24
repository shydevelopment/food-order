export const WEEKDAY_OPTIONS = [
  { value: 0, shortLabel: 'อา', label: 'วันอาทิตย์' },
  { value: 1, shortLabel: 'จ', label: 'วันจันทร์' },
  { value: 2, shortLabel: 'อ', label: 'วันอังคาร' },
  { value: 3, shortLabel: 'พ', label: 'วันพุธ' },
  { value: 4, shortLabel: 'พฤ', label: 'วันพฤหัสบดี' },
  { value: 5, shortLabel: 'ศ', label: 'วันศุกร์' },
  { value: 6, shortLabel: 'ส', label: 'วันเสาร์' },
] as const

export const ALL_WEEKDAY_VALUES = WEEKDAY_OPTIONS.map((day) => day.value)

export const getBangkokDayIndex = (date = new Date()) => (
  new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).getDay()
)

export const normalizeMenuAvailableDays = (
  days: unknown,
  fallback: number[] = ALL_WEEKDAY_VALUES,
) => {
  if (!Array.isArray(days)) return fallback

  const normalized = Array.from(
    new Set(
      days
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ).sort((a, b) => a - b)

  return normalized
}

export const isMenuAvailableOnDay = (
  days: unknown,
  dayIndex = getBangkokDayIndex(),
) => {
  if (!Array.isArray(days)) return true

  const normalizedDays = normalizeMenuAvailableDays(days, [])
  if (normalizedDays.length === 0) return false

  return normalizedDays.includes(dayIndex)
}

export const formatAvailableDays = (days: unknown) => {
  const normalizedDays = normalizeMenuAvailableDays(days, ALL_WEEKDAY_VALUES)
  if (normalizedDays.length === WEEKDAY_OPTIONS.length) return 'ทุกวัน'
  if (normalizedDays.length === 0) return 'ยังไม่เลือกวัน'

  return WEEKDAY_OPTIONS
    .filter((day) => normalizedDays.includes(day.value))
    .map((day) => day.shortLabel)
    .join(', ')
}

export const getWeekdayToneClasses = (
  dayValue: number,
  state: 'selected' | 'muted' | 'today' = 'selected',
) => {
  if (state === 'muted') {
    return 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-700 hover:text-white'
  }

  if (state === 'today') {
    switch (dayValue) {
      case 0:
        return 'border-red-400 bg-red-500 text-white shadow-red-500/20'
      case 1:
        return 'border-yellow-300 bg-yellow-400 text-neutral-950 shadow-yellow-400/20'
      case 2:
        return 'border-pink-400 bg-pink-500 text-white shadow-pink-500/20'
      case 3:
        return 'border-emerald-400 bg-emerald-500 text-white shadow-emerald-500/20'
      case 4:
        return 'border-orange-400 bg-orange-500 text-neutral-950 shadow-orange-500/20'
      case 5:
        return 'border-sky-400 bg-sky-500 text-white shadow-sky-500/20'
      case 6:
        return 'border-purple-400 bg-purple-500 text-white shadow-purple-500/20'
      default:
        return 'border-amber-500 bg-amber-500 text-neutral-950 shadow-amber-500/20'
    }
  }

  switch (dayValue) {
    case 0:
      return 'border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
    case 1:
      return 'border-yellow-400/40 bg-yellow-400/15 text-yellow-200 hover:bg-yellow-400/25'
    case 2:
      return 'border-pink-500/40 bg-pink-500/15 text-pink-200 hover:bg-pink-500/25'
    case 3:
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
    case 4:
      return 'border-orange-500/40 bg-orange-500/15 text-orange-200 hover:bg-orange-500/25'
    case 5:
      return 'border-sky-500/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
    case 6:
      return 'border-purple-500/40 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25'
    default:
      return 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
  }
}
