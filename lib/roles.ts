export const ACCOUNT_ROLES = [
  {
    value: 'customer',
    label: 'Customer',
    thaiLabel: 'Customer',
    description: 'Browse restaurants, order food, and track personal orders.',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  {
    value: 'student',
    label: 'Student',
    thaiLabel: 'Student',
    description: 'KMUTNB student account using @email.kmutnb.ac.th.',
    badgeClass: 'bg-white/10 text-white border-white/40',
  },
  {
    value: 'restaurant',
    label: 'Restaurant',
    thaiLabel: 'Restaurant',
    description: 'Access restaurant workspaces based on Owner or Staff permission.',
    badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  },
  {
    value: 'admin',
    label: 'Admin',
    thaiLabel: 'Admin',
    description: 'Manage users, restaurants, orders, and access permissions.',
    badgeClass: 'bg-red-500/10 text-red-500 border-red-500/30',
  },
] as const

export const RESTAURANT_ACCESS_LEVELS = [
  {
    value: 'owner',
    label: 'Owner',
    thaiLabel: 'Owner',
    description: 'Edit restaurants, add menus, manage staff, and handle orders.',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  {
    value: 'staff',
    label: 'Staff',
    thaiLabel: 'Staff',
    description: 'Handle orders and view assigned restaurant data.',
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

export const getRestaurantAccessLevelMeta = (level: string | null | undefined) => (
  RESTAURANT_ACCESS_LEVELS.find((item) => item.value === level) || null
)
