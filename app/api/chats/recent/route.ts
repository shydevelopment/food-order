import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

interface ProfileRow {
  role: string | null
  email: string | null
}

interface RestaurantMember {
  restaurant_id: string
}

interface ConversationRow {
  id: string
  order_id: string
  restaurant_id: string
  customer_id: string
}

interface ChatMessageRow {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

interface OrderRow {
  id: string
  order_no: number | null
}

interface RestaurantRow {
  id: string
  name: string
}

interface SenderRow {
  id: string
  full_name: string | null
  username: string | null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }

    const sinceParam = req.nextUrl.searchParams.get('since')
    const sinceDate = sinceParam ? new Date(sinceParam) : new Date()
    const checkedAt = new Date().toISOString()

    if (Number.isNaN(sinceDate.getTime())) {
      return NextResponse.json({ error: 'รูปแบบเวลาไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single<ProfileRow>()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 403 })
    }

    let conversationsQuery = supabaseAdmin
      .from('chat_conversations')
      .select('id, order_id, restaurant_id, customer_id')
      .limit(200)

    if (profile.role === 'admin') {
      conversationsQuery = conversationsQuery
    } else if (profile.role === 'restaurant') {
      const ownerFilters = [`owner_id.eq.${user.id}`]

      if (profile.email) {
        ownerFilters.push(`email.eq.${profile.email}`)
      }

      const { data: ownedRestaurants } = await supabaseAdmin
        .from('restaurants')
        .select('id')
        .or(ownerFilters.join(','))

      const { data: restaurantMembers, error: restaurantMembersError } = await supabaseAdmin
        .from('restaurant_members')
        .select('restaurant_id')
        .eq('user_id', user.id)

      if (restaurantMembersError) {
        console.error('Error fetching chat notification restaurant members:', restaurantMembersError.message)
      }

      const ownerRestaurantIds = (ownedRestaurants || []).map((restaurant) => restaurant.id)
      const memberRestaurantIds = ((restaurantMembers || []) as RestaurantMember[]).map((member) => member.restaurant_id)
      const allowedRestaurantIds = Array.from(new Set([...ownerRestaurantIds, ...memberRestaurantIds]))

      conversationsQuery = allowedRestaurantIds.length > 0
        ? conversationsQuery.in('restaurant_id', allowedRestaurantIds)
        : conversationsQuery.in('restaurant_id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      conversationsQuery = conversationsQuery.eq('customer_id', user.id)
    }

    const { data: conversations, error: conversationsError } = await conversationsQuery

    if (conversationsError) {
      return NextResponse.json({ error: conversationsError.message }, { status: 400 })
    }

    const conversationRows = (conversations || []) as ConversationRow[]
    const conversationIds = conversationRows.map((conversation) => conversation.id)

    if (conversationIds.length === 0) {
      return NextResponse.json({ checkedAt, messages: [] })
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .in('conversation_id', conversationIds)
      .neq('sender_id', user.id)
      .gt('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(20)

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 400 })
    }

    const messageRows = (messages || []) as ChatMessageRow[]
    const conversationById = new Map(conversationRows.map((conversation) => [conversation.id, conversation]))
    const orderIds = Array.from(new Set(conversationRows.map((conversation) => conversation.order_id)))
    const restaurantIds = Array.from(new Set(conversationRows.map((conversation) => conversation.restaurant_id)))
    const senderIds = Array.from(new Set(messageRows.map((message) => message.sender_id)))

    const { data: orders } = orderIds.length > 0
      ? await supabaseAdmin
        .from('orders')
        .select('id, order_no')
        .in('id', orderIds)
      : { data: [] }

    const { data: restaurants } = restaurantIds.length > 0
      ? await supabaseAdmin
        .from('restaurants')
        .select('id, name')
        .in('id', restaurantIds)
      : { data: [] }

    const { data: senders } = senderIds.length > 0
      ? await supabaseAdmin
        .from('profiles')
        .select('id, full_name, username')
        .in('id', senderIds)
      : { data: [] }

    const ordersById = new Map(((orders || []) as OrderRow[]).map((order) => [order.id, order]))
    const restaurantsById = new Map(((restaurants || []) as RestaurantRow[]).map((restaurant) => [restaurant.id, restaurant]))
    const sendersById = new Map(((senders || []) as SenderRow[]).map((sender) => [sender.id, sender]))

    return NextResponse.json({
      checkedAt,
      messages: messageRows.map((message) => {
        const conversation = conversationById.get(message.conversation_id)
        const sender = sendersById.get(message.sender_id)

        return {
          id: message.id,
          body: message.body,
          created_at: message.created_at,
          order_id: conversation?.order_id || null,
          order_no: conversation ? ordersById.get(conversation.order_id)?.order_no || null : null,
          restaurant_name: conversation ? restaurantsById.get(conversation.restaurant_id)?.name || null : null,
          sender_name: sender?.full_name || sender?.username || 'คู่สนทนา',
          target_path: profile.role === 'restaurant' || profile.role === 'admin'
            ? '/admin/orders'
            : conversation?.order_id
              ? `/orders?order=${conversation.order_id}`
              : '/orders',
        }
      }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดแจ้งเตือนแชท'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
