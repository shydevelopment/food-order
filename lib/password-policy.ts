export const PASSWORD_REQUIREMENTS_TEXT = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร มีตัวพิมพ์ใหญ่ มีตัวเลข และมี @'

export const PASSWORD_PATTERN = '^(?=.*[A-Z])(?=.*\\d)(?=.*@).{8,}$'

export const getPasswordRequirementStates = (password: string | null | undefined) => {
  const value = password || ''

  return [
    {
      id: 'length',
      label: 'อย่างน้อย 8 ตัวอักษร',
      met: value.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'มีตัวพิมพ์ใหญ่ A-Z',
      met: /[A-Z]/.test(value),
    },
    {
      id: 'number',
      label: 'มีตัวเลข 0-9',
      met: /\d/.test(value),
    },
    {
      id: 'at-sign',
      label: 'มีเครื่องหมาย @',
      met: value.includes('@'),
    },
  ]
}

export const validatePasswordPolicy = (password: string | null | undefined) => {
  const value = password || ''

  if (value.length < 8) {
    return 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร'
  }

  if (!/[A-Z]/.test(value)) {
    return 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว'
  }

  if (!/\d/.test(value)) {
    return 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว'
  }

  if (!value.includes('@')) {
    return 'รหัสผ่านต้องมีเครื่องหมาย @ อย่างน้อย 1 ตัว'
  }

  return null
}
