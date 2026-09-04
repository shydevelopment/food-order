import type { SupabaseClient } from '@supabase/supabase-js'
import { activeOrderStatuses } from '@/lib/order-status'

export interface NotificationFeedItem {
  id: string
  type: 'order' | 'chat'
  title: string
  detail: string
  href: string
  created_at: string
  tone: 'orange' | 'emerald' | 'sky'
  is_read?: boolean
  is_active_order?: boolean
}

interface ProfileRow {
  role: string | null
  email: string | null
}

interface RestaurantMemberRow {
  restaurant_id: string
}

interface RestaurantRow {
  id: string
  name: string
}

interface OrderRow {
  id: string
  order_no: number | null
  user_id: string
  restaurant_id: string
  total_price: number | string
  status: string | null
  pickup_time: string | null
  created_at: string
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

interface SenderRow {
  id: string
  full_name: string | null
  username: string | null
}

interface CustomerRow {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
}

interface NotificationRow {
  id: string
  item_key: string
  type: 'order' | 'chat'
  title: string
  detail: string
  href: string
  tone: 'orange' | 'emerald' | 'sky'
  is_read: boolean
  source_created_at: string
}

const getProfile = async (supabaseAdmin: SupabaseClient, userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .single<ProfileRow>()

  if (error || !data) return null
  return data
}

const getRestaurantIdsForUser = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  profile: ProfileRow,
) => {
  if (profile.role === 'admin') return null
  if (profile.role !== 'restaurant') return []

  const ownerFilters = [`owner_id.eq.${userId}`]
  if (profile.email) ownerFilters.push(`email.eq.${profile.email}`)

  const [{ data: ownerRestaurants }, { data: restaurantMembers }] =
    await Promise.all([
      supabaseAdmin.from('restaurants').select('id').or(ownerFilters.join(',')),
      supabaseAdmin
        .from('restaurant_members')
        .select('restaurant_id')
        .eq('user_id', userId),
    ])

  const ownerRestaurantIds = (
    (ownerRestaurants || []) as Array<{ id: string }>
  ).map((restaurant) => restaurant.id)
  const memberRestaurantIds = (
    (restaurantMembers || []) as RestaurantMemberRow[]
  ).map((member) => member.restaurant_id)

  return Array.from(new Set([...ownerRestaurantIds, ...memberRestaurantIds]))
}

const getRestaurantsById = async (
  supabaseAdmin: SupabaseClient,
  restaurantIds: string[],
) => {
  if (restaurantIds.length === 0) return new Map<string, RestaurantRow>()

  const { data } = await supabaseAdmin
    .from('restaurants')
    .select('id, name')
    .in('id', restaurantIds)

  return new Map(
    ((data || []) as RestaurantRow[]).map((restaurant) => [
      restaurant.id,
      restaurant,
    ]),
  )
}

const getOrderNotifications = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  profile: ProfileRow,
  allowedRestaurantIds: string[] | null,
) => {
  let ordersQuery = supabaseAdmin
    .from('orders')
    .select(
      'id, order_no, user_id, restaurant_id, total_price, status, pickup_time, created_at',
    )
    .in('status', activeOrderStatuses)
    .order('created_at', { ascending: false })
    .limit(30)

  if (profile.role === 'restaurant') {
    ordersQuery =
      allowedRestaurantIds && allowedRestaurantIds.length > 0
        ? ordersQuery.in('restaurant_id', allowedRestaurantIds)
        : ordersQuery.in('restaurant_id', [
            '00000000-0000-0000-0000-000000000000',
          ])
  } else if (profile.role !== 'admin') {
    ordersQuery = ordersQuery.eq('user_id', userId)
  }

  const { data: orders, error } = await ordersQuery
  if (error) throw new Error(error.message)

  const orderRows = (orders || []) as OrderRow[]
  const restaurantIds = Array.from(
    new Set(orderRows.map((order) => order.restaurant_id)),
  )
  const customerIds = Array.from(
    new Set(orderRows.map((order) => order.user_id)),
  )
  const [restaurantsById, { data: customers }] = await Promise.all([
    getRestaurantsById(supabaseAdmin, restaurantIds),
    customerIds.length > 0
      ? supabaseAdmin
          .from('profiles')
          .select('id, full_name, username, email')
          .in('id', customerIds)
      : Promise.resolve({ data: [] }),
  ])
  const customersById = new Map(
    ((customers || []) as CustomerRow[]).map((customer) => [
      customer.id,
      customer,
    ]),
  )
  const isStaffView = profile.role === 'admin' || profile.role === 'restaurant'

  return orderRows.map((order): NotificationFeedItem => {
    const restaurantName =
      restaurantsById.get(order.restaurant_id)?.name || 'ไม่พบชื่อร้าน'
    const customer = customersById.get(order.user_id)
    const customerName =
      customer?.full_name || customer?.username || customer?.email || 'ลูกค้า'
    const pickupText = order.pickup_time ? order.pickup_time.slice(0, 5) : '-'
    const orderLabel = `Order #${order.order_no || order.id.slice(0, 8)}`

    return {
      id: `order-${order.id}`,
      type: 'order',
      title: isStaffView ? `${orderLabel} เข้าใหม่` : orderLabel,
      detail: isStaffView
        ? `ลูกค้า ${customerName} · ${restaurantName} · ยอดรวม ฿${Number(order.total_price || 0).toLocaleString('th-TH')} · รับเวลา ${pickupText}`
        : `สั่งอาหารจาก ${restaurantName} แล้ว · รับเวลา ${pickupText}`,
      href: isStaffView
        ? `/admin/orders?restaurantId=${order.restaurant_id}`
        : `/orders?order=${order.id}`,
      created_at: order.created_at,
      tone: 'orange',
    }
  })
}

const getChatNotifications = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  profile: ProfileRow,
  allowedRestaurantIds: string[] | null,
) => {
  let conversationsQuery = supabaseAdmin
    .from('chat_conversations')
    .select('id, order_id, restaurant_id, customer_id')
    .limit(200)

  if (profile.role === 'restaurant') {
    conversationsQuery =
      allowedRestaurantIds && allowedRestaurantIds.length > 0
        ? conversationsQuery.in('restaurant_id', allowedRestaurantIds)
        : conversationsQuery.in('restaurant_id', [
            '00000000-0000-0000-0000-000000000000',
          ])
  } else if (profile.role !== 'admin') {
    conversationsQuery = conversationsQuery.eq('customer_id', userId)
  }

  const { data: conversations, error: conversationsError } =
    await conversationsQuery
  if (conversationsError) return []

  const conversationRows = (conversations || []) as ConversationRow[]
  const conversationIds = conversationRows.map(
    (conversation) => conversation.id,
  )
  if (conversationIds.length === 0) return []

  const { data: messages, error: messagesError } = await supabaseAdmin
    .from('chat_messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (messagesError) return []

  const messageRows = (messages || []) as ChatMessageRow[]
  const conversationById = new Map(
    conversationRows.map((conversation) => [conversation.id, conversation]),
  )
  const restaurantIds = Array.from(
    new Set(conversationRows.map((conversation) => conversation.restaurant_id)),
  )
  const senderIds = Array.from(
    new Set(messageRows.map((message) => message.sender_id)),
  )

  const [{ data: restaurants }, { data: senders }] = await Promise.all([
    restaurantIds.length > 0
      ? supabaseAdmin
          .from('restaurants')
          .select('id, name')
          .in('id', restaurantIds)
      : Promise.resolve({ data: [] }),
    senderIds.length > 0
      ? supabaseAdmin
          .from('profiles')
          .select('id, full_name, username')
          .in('id', senderIds)
      : Promise.resolve({ data: [] }),
  ])

  const restaurantsById = new Map(
    ((restaurants || []) as RestaurantRow[]).map((restaurant) => [
      restaurant.id,
      restaurant,
    ]),
  )
  const sendersById = new Map(
    ((senders || []) as SenderRow[]).map((sender) => [sender.id, sender]),
  )
  const isStaffView = profile.role === 'admin' || profile.role === 'restaurant'

  return messageRows.map((message): NotificationFeedItem => {
    const conversation = conversationById.get(message.conversation_id)
    const sender = sendersById.get(message.sender_id)
    const restaurantName = conversation
      ? restaurantsById.get(conversation.restaurant_id)?.name || null
      : null

    return {
      id: `chat-${message.id}`,
      type: 'chat',
      title: sender?.full_name || sender?.username || 'ข้อความใหม่',
      detail: `${message.body}${restaurantName ? ` · ${restaurantName}` : ''}`,
      href: isStaffView
        ? '/admin/orders'
        : conversation?.order_id
          ? `/orders?order=${conversation.order_id}`
          : '/orders',
      created_at: message.created_at,
      tone: 'sky',
    }
  })
}

const syncNotificationsToSupabase = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  items: NotificationFeedItem[],
) => {
  if (items.length === 0) return

  const payload = items.map((item) => ({
    user_id: userId,
    item_key: item.id,
    type: item.type,
    title: item.title,
    detail: item.detail,
    href: item.href,
    tone: item.tone,
    source_created_at: item.created_at,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin
    .from('notifications')
    .upsert(payload, { onConflict: 'user_id,item_key' })

  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('notifications')
    ) {
      throw new Error(
        'ฐานข้อมูลยังไม่มีตาราง notifications กรุณารันไฟล์ supabase/notifications.sql ใน Supabase SQL Editor ก่อน',
      )
    }

    throw new Error(error.message)
  }
}

const readNotificationsFromSupabase = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  activeOrderIds: Set<string>,
) => {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select(
      'id, item_key, type, title, detail, href, tone, is_read, source_created_at',
    )
    .eq('user_id', userId)
    .order('source_created_at', { ascending: false })
    .limit(80)

  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('notifications')
    ) {
      throw new Error(
        'ฐานข้อมูลยังไม่มีตาราง notifications กรุณารันไฟล์ supabase/notifications.sql ใน Supabase SQL Editor ก่อน',
      )
    }

    throw new Error(error.message)
  }

  return ((data || []) as NotificationRow[])
    .map((item): NotificationFeedItem => {
      const itemKey = item.item_key || item.id
      const isActiveOrder = isActiveOrderNotification(itemKey, activeOrderIds)

      return {
        id: itemKey,
        type: item.type,
        title: item.title,
        detail: item.detail,
        href: item.href,
        created_at: item.source_created_at,
        tone: item.tone,
        is_read: item.is_read,
        is_active_order: isActiveOrder,
      }
    })
    .sort(sortNotificationItems)
}

const isActiveOrderNotification = (
  itemKey: string,
  activeOrderIds: Set<string>,
) => {
  if (activeOrderIds.size === 0) return false
  if (
    itemKey.startsWith('order-') &&
    activeOrderIds.has(itemKey.slice('order-'.length))
  )
    return true

  return Array.from(activeOrderIds).some((orderId) =>
    itemKey.startsWith(`order-status-${orderId}-`),
  )
}

const sortNotificationItems = (
  a: NotificationFeedItem,
  b: NotificationFeedItem,
) => {
  if (Boolean(a.is_active_order) !== Boolean(b.is_active_order)) {
    return a.is_active_order ? -1 : 1
  }

  if (Boolean(a.is_read) !== Boolean(b.is_read)) {
    return a.is_read ? 1 : -1
  }

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

export const getNotificationFeed = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
) => {
  const profile = await getProfile(supabaseAdmin, userId)
  if (!profile) {
    return {
      profile: null,
      items: [] as NotificationFeedItem[],
    }
  }

  const allowedRestaurantIds = await getRestaurantIdsForUser(
    supabaseAdmin,
    userId,
    profile,
  )
  const [orderItems, chatItems] = await Promise.all([
    getOrderNotifications(supabaseAdmin, userId, profile, allowedRestaurantIds),
    getChatNotifications(supabaseAdmin, userId, profile, allowedRestaurantIds),
  ])
  const derivedItems = [...orderItems, ...chatItems].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const activeOrderIds = new Set(
    orderItems
      .filter((item) => item.id.startsWith('order-'))
      .map((item) => item.id.slice('order-'.length)),
  )

  await syncNotificationsToSupabase(supabaseAdmin, userId, derivedItems)

  return {
    profile,
    items: await readNotificationsFromSupabase(
      supabaseAdmin,
      userId,
      activeOrderIds,
    ),
  }
}
