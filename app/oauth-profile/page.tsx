import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import GoogleProfileForm from '@/components/google-profile-form'
import { createClient } from '@/supabase/service'
import { getKmutnbStudentUsernameFromEmail, isKmutnbStudentEmail, resolveAccountRoleForEmail } from '@/lib/roles'

type SearchParams = {
  message?: string
}

const getMetadataString = (metadata: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

export default async function OAuthProfilePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, phone, avatar_url, role, email')
    .eq('id', user.id)
    .maybeSingle()

  const metadata = user.user_metadata || {}
  const isStudent = isKmutnbStudentEmail(user.email)
  const studentUsername = getKmutnbStudentUsernameFromEmail(user.email)
  const emailUsername = user.email.split('@')[0]
  const googleUsername = getMetadataString(metadata, ['user_name', 'preferred_username'])
  const googleDisplayName = getMetadataString(metadata, ['full_name', 'name'])
  const username = isStudent
    ? studentUsername || emailUsername
    : profile?.username || googleUsername || emailUsername
  const displayName = isStudent
    ? googleDisplayName || profile?.full_name || username
    : profile?.full_name || googleDisplayName || username
  const phone = profile?.phone || ''

  if (profile?.username && profile?.full_name && profile?.phone && profile?.email) {
    redirect('/')
  }

  const saveGoogleProfile = async (formData: FormData) => {
    'use server'

    const supabaseServer = await createClient()
    const { data: { user: currentUser } } = await supabaseServer.auth.getUser()

    if (!currentUser?.email) {
      redirect('/login')
    }

    const currentMetadata = currentUser.user_metadata || {}
    const currentIsStudent = isKmutnbStudentEmail(currentUser.email)
    const submittedUsername = String(formData.get('username') || '').trim()
    const submittedDisplayName = String(formData.get('displayName') || '').trim()
    const submittedPhone = String(formData.get('phone') || '').trim()
    const currentStudentUsername = getKmutnbStudentUsernameFromEmail(currentUser.email)
    const currentGoogleDisplayName = getMetadataString(currentMetadata, ['full_name', 'name'])
    const currentGoogleAvatarUrl = getMetadataString(currentMetadata, ['avatar_url', 'picture'])
    const resolvedUsername = currentIsStudent
      ? currentStudentUsername || currentUser.email.split('@')[0]
      : submittedUsername
    const resolvedDisplayName = currentIsStudent
      ? currentGoogleDisplayName || resolvedUsername
      : submittedDisplayName

    if (!resolvedUsername || !resolvedDisplayName) {
      redirect('/oauth-profile?message=' + encodeURIComponent('กรุณากรอก Username และ Display Name ให้ครบ'))
    }

    if (!/^0[0-9]{8,9}$/.test(submittedPhone)) {
      redirect('/oauth-profile?message=' + encodeURIComponent('เบอร์โทรศัพท์ไม่ถูกต้อง ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก'))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      redirect('/oauth-profile?message=' + encodeURIComponent('ระบบยังไม่ได้ตั้งค่า service role key'))
    }

    const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey)
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .maybeSingle()
    const resolvedRole = currentProfile?.role === 'admin' || currentProfile?.role === 'restaurant'
      ? currentProfile.role
      : resolveAccountRoleForEmail(currentUser.email, currentProfile?.role || 'customer')

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: currentUser.id,
          email: currentUser.email,
          username: resolvedUsername,
          full_name: resolvedDisplayName,
          phone: submittedPhone,
          avatar_url: currentGoogleAvatarUrl,
          role: resolvedRole,
        },
        { onConflict: 'id' }
      )

    if (error) {
      redirect('/oauth-profile?message=' + encodeURIComponent(error.message))
    }

    redirect('/')
  }

  return (
    <GoogleProfileForm
      saveAction={saveGoogleProfile}
      email={user.email}
      username={username}
      displayName={displayName}
      phone={phone}
      isStudent={isStudent}
      message={resolvedSearchParams.message}
    />
  )
}
