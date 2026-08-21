import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { syncStudentRoleForUser } from '@/lib/student-role-sync'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ role: null }, { status: 401 })
  }

  const role = await syncStudentRoleForUser({
    id: user.id,
    email: user.email,
    userMetadata: user.user_metadata,
  })

  return NextResponse.json({ role })
}
