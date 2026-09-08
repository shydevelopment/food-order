import type { User } from '@supabase/supabase-js'

export function isEmailVerified(user: Pick<User, 'email' | 'email_confirmed_at' | 'app_metadata'>): boolean {
  if (user.app_metadata.email_verification_required === true) {
    return Boolean(user.email && user.app_metadata.verified_email === user.email)
  }
  return Boolean(user.email_confirmed_at)
}
