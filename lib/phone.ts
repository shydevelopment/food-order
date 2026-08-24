const THAI_MOBILE_PATTERN = /^0[689]\d{8}$/

export const THAI_PHONE_INPUT_PATTERN =
  '^(?:0[689][0-9]{8}|0[689][0-9]-[0-9]{3}-[0-9]{4}|\\+?66[689][0-9]{8}|\\+?66[689][0-9]-[0-9]{3}-[0-9]{4})$'
export const THAI_PHONE_REQUIREMENTS_TEXT =
  'กรุณากรอกเบอร์มือถือไทย 10 หลัก เช่น 0812345678 หรือ +66812345678'
export const DUPLICATE_PHONE_MESSAGE = 'เบอร์โทรศัพท์นี้ถูกใช้งานโดยบัญชีอื่นแล้ว'

export function normalizeThaiPhone(rawPhone: FormDataEntryValue | string | null | undefined) {
  if (typeof rawPhone !== 'string') return ''

  const compactPhone = rawPhone.replace(/[\s-]/g, '')

  if (/^\+?66[689]\d{8}$/.test(compactPhone)) {
    return `0${compactPhone.replace(/^\+?66/, '')}`
  }

  return compactPhone
}

export function validateThaiPhone(rawPhone: FormDataEntryValue | string | null | undefined) {
  const phone = normalizeThaiPhone(rawPhone)

  if (!THAI_MOBILE_PATTERN.test(phone)) {
    return {
      success: false as const,
      phone,
      message: THAI_PHONE_REQUIREMENTS_TEXT,
    }
  }

  return {
    success: true as const,
    phone,
  }
}

export function formatThaiPhoneInput(rawPhone: string) {
  const normalizedPhone = normalizeThaiPhone(rawPhone)
  const digits = normalizedPhone.replace(/\D/g, '').slice(0, 10)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}
