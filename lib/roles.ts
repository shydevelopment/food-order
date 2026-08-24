export const ACCOUNT_ROLES = [
  {
    value: 'customer',
    label: 'Customer',
    thaiLabel: 'ลูกค้า',
    description: 'ดูร้าน ดูเมนู สั่งอาหาร และติดตามออเดอร์ของตัวเอง',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  {
    value: 'student',
    label: 'Student',
    thaiLabel: 'นักศึกษา',
    description: 'บัญชีที่ใช้อีเมลมหาลัย @email.kmutnb.ac.th สำหรับสั่งอาหารและสิทธินักศึกษา',
    badgeClass: 'bg-white/10 text-white border-white/40',
  },
  {
    value: 'restaurant',
    label: 'Restaurant',
    thaiLabel: 'ร้านค้า',
    description: 'เข้าพื้นที่ร้านตามสิทธิ์ owner/staff ที่ได้รับ',
    badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  },
  {
    value: 'admin',
    label: 'Admin',
    thaiLabel: 'แอดมิน',
    description: 'จัดการระบบ ผู้ใช้ ร้านอาหาร ออเดอร์ และสิทธิ์ร้านทั้งหมด',
    badgeClass: 'bg-red-500/10 text-red-500 border-red-500/30',
  },
] as const

export const RESTAURANT_ACCESS_LEVELS = [
  {
    value: 'owner',
    label: 'Owner',
    thaiLabel: 'เจ้าของร้าน',
    description: 'แก้ไขร้าน เพิ่มเมนู เพิ่มลูกน้อง และรับออเดอร์',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  {
    value: 'staff',
    label: 'Staff',
    thaiLabel: 'พนักงานร้าน',
    description: 'รับออเดอร์และดูข้อมูลร้านที่ได้รับสิทธิ์',
    badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
] as const

export const NON_STUDENT_LABEL = 'คุณไม่ได้เป็นบุคลากรในมหาวิทยาลัย'

export type AccountRole = typeof ACCOUNT_ROLES[number]['value']
export type RestaurantAccessLevel = typeof RESTAURANT_ACCESS_LEVELS[number]['value']

export const ACCOUNT_ROLE_VALUES = ACCOUNT_ROLES.map((role) => role.value)
export const RESTAURANT_ACCESS_LEVEL_VALUES = RESTAURANT_ACCESS_LEVELS.map((level) => level.value)

export const canHaveRestaurantAccess = (role: string | null | undefined) => (
  role === 'restaurant' || role === 'admin'
)

export const isKmutnbStudentEmail = (email: string | null | undefined) => (
  Boolean(email?.trim().toLowerCase().endsWith('@email.kmutnb.ac.th'))
)

export const getKmutnbStudentUsernameFromEmail = (email: string | null | undefined) => {
  if (!isKmutnbStudentEmail(email)) return null

  const username = email?.trim().toLowerCase().split('@')[0]
  if (!username) return null

  return username.replace(/^s(?=\d)/, '')
}

export const getProfileStudentId = (profile: {
  student_id?: string | null
  username?: string | null
  role?: string | null
}, email: string | null | undefined) => {
  const explicitStudentId = profile.student_id?.trim()
  if (explicitStudentId) return explicitStudentId

  if (profile.role === 'student' || isKmutnbStudentEmail(email)) {
    return getKmutnbStudentUsernameFromEmail(email) || profile.username?.trim() || null
  }

  return null
}

export const getProfileStudentIdDisplay = (profile: {
  student_id?: string | null
  username?: string | null
  role?: string | null
}, email: string | null | undefined) => (
  getProfileStudentId(profile, email) || NON_STUDENT_LABEL
)

export const resolveAccountRoleForEmail = (
  email: string | null | undefined,
  requestedRole: string | null | undefined = 'customer'
) => {
  if (isKmutnbStudentEmail(email)) return 'student'
  return ACCOUNT_ROLES.some((role) => role.value === requestedRole) ? requestedRole! : 'customer'
}

export const getAccountRoleMeta = (role: string | null | undefined) => (
  ACCOUNT_ROLES.find((item) => item.value === role) || null
)
