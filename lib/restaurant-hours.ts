const BANGKOK_TIME_ZONE = 'Asia/Bangkok'

const parseTimeToMinutes = (time: string | null | undefined) => {
  if (!time) return null

  const [hourPart, minutePart = '0'] = time.split(':')
  const hours = Number(hourPart)
  const minutes = Number(minutePart)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

export const getBangkokCurrentMinutes = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0) % 24
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)

  return hour * 60 + minute
}

export const isWithinRestaurantHours = (
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
  date = new Date(),
) => {
  const openMinutes = parseTimeToMinutes(openTime)
  const closeMinutes = parseTimeToMinutes(closeTime)

  if (openMinutes === null || closeMinutes === null) return true
  if (openMinutes === closeMinutes) return true

  const currentMinutes = getBangkokCurrentMinutes(date)

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}

export const isRestaurantOpenNow = (
  status: string | null | undefined,
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
  date = new Date(),
) => status === 'open' && isWithinRestaurantHours(openTime, closeTime, date)

export const formatRestaurantTimeRange = (
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
) => {
  if (!openTime && !closeTime) return 'ยังไม่ระบุเวลา'
  return `${openTime?.slice(0, 5) || '--:--'} - ${closeTime?.slice(0, 5) || '--:--'} น.`
}
