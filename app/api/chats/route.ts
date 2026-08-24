import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

interface ProfileRow {
  role: string | null
  email: string | null
}

const createAdminClient = () => createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

const canAccessRestaurantOrder = async (
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  profile: ProfileRow,
  restaurantId: string
) => {
  if (profile.role === 'admin') return true
  if (profile.role !== 'restaurant') return false

  const ownerFilters = [`owner_id.eq.${userId}`]
  if (profile.email) {
    ownerFilters.push(`email.eq.${profile.email}`)
  }

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .or(ownerFilters.join(','))
    .maybeSingle()

  const { data: restaurantMember, error: restaurantMemberError } = await supabaseAdmin
    .from('restaurant_members')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', userId)
    .maybeSingle()

  if (restaurantMemberError) {
    console.error('Error checking restaurant chat member access:', restaurantMemberError.message)
  }

  return Boolean(!restaurantError && (restaurant || restaurantMember))
}

const getAuthorizedConversation = async (req: NextRequest) => {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) }
  }

  const body = req.method === 'GET' ? null : await req.json()
  const orderId = req.method === 'GET'
    ? req.nextUrl.searchParams.get('orderId')
    : String(body.orderId || '')

  if (!orderId) {
    return { error: NextResponse.json({ error: 'กรุณาระบุออร์เดอร์' }, { status: 400 }) }
  }

  const supabaseAdmin = createAdminClient()
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, order_no, user_id, restaurant_id')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return { error: NextResponse.json({ error: 'ไม่พบออร์เดอร์นี้' }, { status: 404 }) }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 403 }) }
  }

  const isCustomer = order.user_id === user.id
  const hasRestaurantAccess = await canAccessRestaurantOrder(
    supabaseAdmin,
    user.id,
    profile as ProfileRow,
    order.restaurant_id
  )

  if (!isCustomer && !hasRestaurantAccess) {
    return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงแชทนี้' }, { status: 403 }) }
  }

  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from('chat_conversations')
    .upsert({
      order_id: order.id,
      restaurant_id: order.restaurant_id,
      customer_id: order.user_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_id' })
    .select('id, order_id, restaurant_id, customer_id')
    .single()

  if (conversationError || !conversation) {
    return { error: NextResponse.json({ error: conversationError?.message || 'ไม่สามารถเปิดแชทได้' }, { status: 400 }) }
  }

  return {
    body,
    user,
    order,
    profile: profile as ProfileRow,
    conversation,
    supabaseAdmin,
  }
}

export async function GET(req: NextRequest) {
  try {
    const context = await getAuthorizedConversation(req)
    if ('error' in context) return context.error

    const { data: messages, error: messagesError } = await context.supabaseAdmin
      .from('chat_messages')
      .select('id, conversation_id, sender_id, body, created_at, read_at')
      .eq('conversation_id', context.conversation.id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 400 })
    }

    return NextResponse.json({
      conversation: context.conversation,
      messages: messages || [],
      currentUserId: context.user.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดแชท'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getAuthorizedConversation(req)
    if ('error' in context) return context.error

    const messageBody = String(context.body?.message || '').trim()

    if (!messageBody || messageBody.length > 500) {
      return NextResponse.json({ error: 'ข้อความต้องมีความยาว 1-500 ตัวอักษร' }, { status: 400 })
    }

    const { data: message, error: messageError } = await context.supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: context.conversation.id,
        sender_id: context.user.id,
        body: messageBody,
      })
      .select('id, conversation_id, sender_id, body, created_at, read_at')
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: messageError?.message || 'ส่งข้อความไม่สำเร็จ' }, { status: 400 })
    }

    await context.supabaseAdmin
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', context.conversation.id)

    return NextResponse.json({ message })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการส่งข้อความ'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
