export const systemNotificationOptions = [
  {
    id: 'order_status',
    label: 'สถานะออร์เดอร์',
    description: 'แจ้งเมื่อร้านรับออเดอร์ พร้อมให้มารับอาหาร หรือออเดอร์เสร็จสิ้น',
  },
  {
    id: 'account_security',
    label: 'ความปลอดภัยบัญชี',
    description: 'แจ้งเมื่อมีการเปลี่ยนรหัสผ่าน เข้าสู่ระบบ หรือแก้ไขข้อมูลสำคัญ',
  },
  {
    id: 'restaurant_updates',
    label: 'อัปเดตร้านอาหาร',
    description: 'แจ้งร้านเปิดปิด เมนูใหม่ หรือรายการที่เกี่ยวกับร้านที่ใช้งาน',
  },
  {
    id: 'admin_messages',
    label: 'ประกาศจากแอดมิน',
    description: 'แจ้งข่าวระบบและประกาศสำคัญจากผู้ดูแล',
  },
  {
    id: 'promotions',
    label: 'โปรโมชัน',
    description: 'แจ้งส่วนลด เมนูแนะนำ หรือกิจกรรมพิเศษ',
  },
] as const

export type SystemNotificationId = typeof systemNotificationOptions[number]['id']

export interface CustomNotificationSound {
  id: string
  sound_id?: string
  name: string
  url: string
  duration: number
}

export interface NotificationPreferences {
  system: SystemNotificationId[]
  custom: CustomNotificationSound[]
}

const systemNotificationIds = new Set(systemNotificationOptions.map((option) => option.id))

export const defaultNotificationPreferences: NotificationPreferences = {
  system: ['order_status', 'account_security', 'admin_messages'],
  custom: [],
}

const normalizeCustomNotifications = (values: unknown) => {
  if (!Array.isArray(values)) return []

  const seenUrls = new Set<string>()
  const normalizedSounds: CustomNotificationSound[] = []

  values.forEach((value) => {
    if (!value || typeof value !== 'object') return

    const sound = value as Partial<CustomNotificationSound>
    const url = String(sound.url || '').trim()

    if (!url || seenUrls.has(url)) return

    seenUrls.add(url)
    normalizedSounds.push({
      id: String(sound.id || crypto.randomUUID()).slice(0, 80),
      sound_id: sound.sound_id ? String(sound.sound_id).slice(0, 80) : undefined,
      name: String(sound.name || 'Notification sound').trim().slice(0, 80),
      url,
      duration: Number.isFinite(Number(sound.duration)) ? Number(sound.duration) : 0,
    })
  })

  return normalizedSounds.slice(0, 10)
}

export const normalizeNotificationPreferences = (value: unknown): NotificationPreferences => {
  if (!value || typeof value !== 'object') {
    return defaultNotificationPreferences
  }

  const candidate = value as Partial<NotificationPreferences>
  const system = Array.isArray(candidate.system)
    ? candidate.system.filter((id): id is SystemNotificationId => systemNotificationIds.has(id as SystemNotificationId))
    : defaultNotificationPreferences.system

  return {
    system: Array.from(new Set(system)),
    custom: normalizeCustomNotifications(candidate.custom),
  }
}
