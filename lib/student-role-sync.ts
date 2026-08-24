import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { getKmutnbStudentUsernameFromEmail, isKmutnbStudentEmail } from '@/lib/roles'

type SyncableUser = {
  id: string
  email?: string | null
  userMetadata?: Record<string, unknown> | null
}

export async function syncStudentRoleForUser(user: SyncableUser) {
  if (!isKmutnbStudentEmail(user.email)) {
    return null
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey)

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'admin' || profile?.role === 'restaurant') {
    return profile.role
  }

  if (profile?.role === 'student') {
    return 'student'
  }

  const metadata = user.userMetadata || {}
  const username = getKmutnbStudentUsernameFromEmail(user.email) || 'student'
  const studentId = getKmutnbStudentUsernameFromEmail(user.email)
  const fullName = typeof metadata.full_name === 'string'
    ? metadata.full_name
    : typeof metadata.name === 'string'
      ? metadata.name
      : username
  const avatarUrl = typeof metadata.avatar_url === 'string'
    ? metadata.avatar_url
    : typeof metadata.picture === 'string'
      ? metadata.picture
      : null

  const { error } = profile?.id
    ? await supabaseAdmin
      .from('profiles')
      .update({ role: 'student', username, student_id: studentId })
      .eq('id', user.id)
    : await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          username,
          student_id: studentId,
          full_name: fullName,
          avatar_url: avatarUrl,
          role: 'student',
        },
        { onConflict: 'id' }
      )

  if (error) {
    return profile?.role || null
  }

  return 'student'
}
