import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildLocalAiReply,
  retrieveAiKnowledge,
  STATIC_AI_KNOWLEDGE,
  type AiKnowledgeItem,
} from '@/lib/ai-chatbot-knowledge'
import { getSiteUrl } from '@/lib/site-url'
import { formatRestaurantTimeRange, isRestaurantOpenNow } from '@/lib/restaurant-hours'
import { getRestaurantTypeMeta, RESTAURANT_TYPES, type RestaurantType } from '@/lib/restaurant-types'
import { createClient as createSessionClient } from '@/supabase/service'
import { formatAvailableDays, getBangkokDayIndex, isMenuAvailableOnDay } from '@/lib/menu-days'
import { getOrderStatusLabel } from '@/lib/order-status'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type RestaurantRow = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  email: string | null
  phone: string | null
  address: string | null
  status: string | null
  open_time: string | null
  close_time: string | null
  restaurant_type: string | null
  unavailable_ingredients: string[] | null
}

type MenuRow = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  price: number | string
  is_available: boolean | null
  available_days: number[] | null
  category_id: string | null
}

type MenuCategoryRow = {
  id: string
  restaurant_id: string
  name: string
}

type OrderRow = {
  id: string
  order_no: number | null
  restaurant_id: string
  total_price: number | string
  status: string | null
  pickup_time: string | null
  cancellation_reason: string | null
  created_at: string
}

type OrderItemRow = {
  order_id: string
  menu_id: string | null
  custom_name: string | null
  quantity: number
  price: number | string
}

type RestaurantRecommendation = {
  id: string
  name: string
  description: string
  href: string
  menuHref: string
  contactHref: string
  contactLabel: string
  imageUrl: string
  statusLabel: string
  isOpen: boolean
  hours: string
  typeLabel: string
  typeIcon: string
  availableMenuCount: number
  matchedMenus: string[]
}

const SYSTEM_PROMPT = `คุณคือ AI ผู้ช่วยของ Food Order KMUTNB
ตอบเป็นภาษาไทย สุภาพ กระชับ และช่วยให้ผู้ใช้สั่งอาหารได้ง่ายขึ้น
ตอบจากข้อมูลร้าน เมนู ความจำ และบริบทที่ระบบส่งให้เท่านั้น
ถ้าข้อมูลไม่พอ ให้บอกว่ายังไม่มีข้อมูลหรือถามเพิ่ม ห้ามเดาราคา เวลาเปิดร้าน หรือสถานะออเดอร์
เข้าใจคำถามต่อเนื่องจากประวัติแชท เช่น “ร้านแรก”, “ร้านนั้น” หรือ “มีอะไรอีก”
เมื่อผู้ใช้ระบุงบ ให้แนะนำเฉพาะเมนูที่ราคาไม่เกินงบ และอธิบายเหตุผลที่เลือกสั้น ๆ
ถ้าผู้ใช้ถามวิธีทำ chatbot หรือการเทรน ให้แนะนำแบบ RAG + memory ก่อน fine-tuning
เมื่อแนะนำร้านอาหาร ให้เรียกชื่อร้านหรือเมนูที่ตรงคำถาม ตอบแบบเป็นธรรมชาติ และบอกผู้ใช้ว่ากดการ์ดร้านด้านล่างเพื่อเข้าหน้าร้านได้ ไม่ต้องเขียน markdown link เอง`

const FOLLOW_UP_PATTERN = /ร้าน(?:นั้น|นี้|แรก|ที่\s*[1234])|อัน(?:นั้น|นี้|แรก)|แล้ว(?:ล่ะ|ละ)|มีอะไรอีก|อีกไหม|เท่าไหร่|กี่โมง/i

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const key = serviceRoleKey || anonKey

  if (!url || !/^https:\/\//i.test(url) || !key) return null
  return { url, key }
}

function createReadClient() {
  const config = getSupabaseConfig()
  if (!config) return null

  return createSupabaseClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

type StoreContext = {
  knowledge: AiKnowledgeItem[]
  restaurants: RestaurantRow[]
  menus: MenuRow[]
  supabaseConfigured: boolean
}

async function getStoreContext(): Promise<StoreContext> {
  const supabase = createReadClient()
  if (!supabase) {
    return {
      knowledge: [],
      restaurants: [],
      menus: [],
      supabaseConfigured: false,
    }
  }

  const [restaurantResult, menuResult, categoryResult] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, description, image_url, email, phone, address, status, open_time, close_time, restaurant_type, unavailable_ingredients'),
    supabase
      .from('menus')
      .select('id, restaurant_id, name, description, price, is_available, available_days, category_id'),
    supabase
      .from('menu_categories')
      .select('id, restaurant_id, name'),
  ])

  if (restaurantResult.error) console.error('AI restaurants query failed:', restaurantResult.error.message)
  if (menuResult.error) console.error('AI menus query failed:', menuResult.error.message)
  if (categoryResult.error) console.error('AI categories query failed:', categoryResult.error.message)

  const restaurantRows = (restaurantResult.data || []) as RestaurantRow[]
  const menuRows = (menuResult.data || []) as MenuRow[]
  const categoryRows = (categoryResult.data || []) as MenuCategoryRow[]
  const restaurantById = new Map(restaurantRows.map((restaurant) => [restaurant.id, restaurant]))
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]))
  const todayIndex = getBangkokDayIndex()

  const restaurantKnowledge = restaurantRows.map((restaurant): AiKnowledgeItem => {
    const hours = formatRestaurantTimeRange(restaurant.open_time, restaurant.close_time)
    const status = restaurant.status === 'open' ? 'เปิดอยู่' : restaurant.status === 'closed' ? 'ปิดอยู่' : 'ยังไม่ระบุสถานะ'
    const typeMeta = getRestaurantTypeMeta(restaurant.restaurant_type)

    return {
      id: `restaurant-${restaurant.id}`,
      title: restaurant.name,
      category: 'restaurant',
      content: `ร้าน ${restaurant.name} ประเภท ${typeMeta.label} ${status} เวลา ${hours}${restaurant.address ? ` ที่อยู่ ${restaurant.address}` : ''}${restaurant.phone ? ` โทร ${restaurant.phone}` : ''}${restaurant.description ? ` รายละเอียด ${restaurant.description}` : ` ${typeMeta.description}`}${restaurant.unavailable_ingredients?.length ? ` วัตถุดิบที่หมด: ${restaurant.unavailable_ingredients.join(', ')}` : ''}`,
      keywords: [
        restaurant.name,
        restaurant.address || '',
        restaurant.email || '',
        restaurant.phone || '',
        restaurant.description || '',
        restaurant.restaurant_type || '',
        typeMeta.label,
        typeMeta.description,
        ...(restaurant.unavailable_ingredients || []),
        'ร้าน',
        'เปิด',
        'ปิด',
        'เวลา',
        'ประเภท',
      ].filter(Boolean),
    }
  })

  const menuKnowledge = menuRows.map((menu): AiKnowledgeItem => {
    const restaurant = restaurantById.get(menu.restaurant_id)
    const category = menu.category_id ? categoryById.get(menu.category_id) : null
    const availableToday = Boolean(menu.is_available) && isMenuAvailableOnDay(menu.available_days, todayIndex)
    const availability = availableToday ? 'พร้อมขายวันนี้' : 'วันนี้ไม่พร้อมขาย'

    return {
      id: `menu-${menu.id}`,
      title: menu.name,
      category: 'menu',
      content: `${menu.name} ราคา ${Number(menu.price).toLocaleString('th-TH')} บาท ${availability}${restaurant ? ` จากร้าน ${restaurant.name}` : ''}${category ? ` หมวด ${category.name}` : ''} ขาย ${formatAvailableDays(menu.available_days)}${menu.description ? ` รายละเอียด ${menu.description}` : ''}`,
      keywords: [
        menu.name,
        menu.description || '',
        restaurant?.name || '',
        category?.name || '',
        String(menu.price),
        ...(menu.available_days || []).map(String),
        'ของทานเล่น',
        'เมนู',
        'อาหาร',
        'ราคา',
        'บาท',
        'ถูก',
        'ขายวันนี้',
        'พร้อมขาย',
        'หมด',
        'ไม่มี',
        formatAvailableDays(menu.available_days),
      ].filter(Boolean),
    }
  })

  return {
    knowledge: [...restaurantKnowledge, ...menuKnowledge],
    restaurants: restaurantRows,
    menus: menuRows,
    supabaseConfigured: true,
  }
}

function asksForPersonalOrder(question: string) {
  return /ออเดอร์(?:ของฉัน|ของผม|ของเรา)?|คำสั่งซื้อ(?:ของฉัน|ของผม|ของเรา)?|สั่งไป|สถานะ.*(?:อาหาร|ออเดอร์|คำสั่งซื้อ)|อาหาร.*ถึงไหน|รับอาหารกี่โมง/i.test(question)
}

async function getPersonalOrderKnowledge(question: string): Promise<{
  knowledge: AiKnowledgeItem[]
  requiresLogin: boolean
}> {
  if (!asksForPersonalOrder(question)) return { knowledge: [], requiresLogin: false }
  if (!getSupabaseConfig()) return { knowledge: [], requiresLogin: false }

  const supabase = await createSessionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { knowledge: [], requiresLogin: true }

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_no, restaurant_id, total_price, status, pickup_time, cancellation_reason, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('AI personal orders query failed:', error.message)
    return { knowledge: [], requiresLogin: false }
  }

  const orderRows = (orders || []) as OrderRow[]
  const orderIds = orderRows.map((order) => order.id)
  const restaurantIds = Array.from(new Set(orderRows.map((order) => order.restaurant_id)))
  const [{ data: restaurants }, { data: orderItems }] = await Promise.all([
    restaurantIds.length
      ? supabase.from('restaurants').select('id, name').in('id', restaurantIds)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? supabase
          .from('order_items')
          .select('order_id, menu_id, custom_name, quantity, price')
          .in('order_id', orderIds)
      : Promise.resolve({ data: [] }),
  ])
  const restaurantNames = new Map((restaurants || []).map((restaurant) => [restaurant.id, restaurant.name]))
  const itemRows = (orderItems || []) as OrderItemRow[]
  const menuIds = Array.from(new Set(itemRows.map((item) => item.menu_id).filter((id): id is string => Boolean(id))))
  const { data: menus } = menuIds.length
    ? await supabase.from('menus').select('id, name').in('id', menuIds)
    : { data: [] }
  const menuNames = new Map((menus || []).map((menu) => [menu.id, menu.name]))
  const itemsByOrder = new Map<string, string[]>()
  itemRows.forEach((item) => {
    const name = item.custom_name || (item.menu_id ? menuNames.get(item.menu_id) : null) || 'รายการอาหาร'
    const summary = `${name} x${item.quantity} (${Number(item.price).toLocaleString('th-TH')} บาท/รายการ)`
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) || []), summary])
  })

  return {
    requiresLogin: false,
    knowledge: orderRows.map((order) => ({
      id: `order-${order.id}`,
      title: `ออเดอร์ #${order.order_no || order.id.slice(0, 8)}`,
      category: 'order' as const,
      content: `ออเดอร์ #${order.order_no || order.id.slice(0, 8)} จากร้าน ${restaurantNames.get(order.restaurant_id) || 'ไม่พบชื่อร้าน'} สถานะ ${getOrderStatusLabel(order.status)} ยอด ${Number(order.total_price).toLocaleString('th-TH')} บาท${itemsByOrder.get(order.id)?.length ? ` รายการ: ${itemsByOrder.get(order.id)?.join(', ')}` : ''}${order.pickup_time ? ` รับเวลา ${order.pickup_time.slice(0, 5)} น.` : ''}${order.cancellation_reason ? ` เหตุผลที่ยกเลิก: ${order.cancellation_reason}` : ''} สั่งเมื่อ ${new Date(order.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
      keywords: ['ออเดอร์', 'คำสั่งซื้อ', 'สถานะ', String(order.order_no || ''), restaurantNames.get(order.restaurant_id) || ''],
    })),
  }
}

function memoryToKnowledge(memories: unknown): AiKnowledgeItem[] {
  if (!Array.isArray(memories)) return []

  return memories
    .map((memory) => String(memory || '').trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((memory, index) => ({
      id: `memory-${index}`,
      title: `ความจำ ${index + 1}`,
      category: 'memory' as const,
      content: `ข้อมูลที่ผู้ใช้สอนให้จำ: ${memory.slice(0, 240)}`,
      keywords: tokenizeMemory(memory),
    }))
}

function tokenizeMemory(memory: string) {
  return memory
    .split(/[\s,.;:!?()[\]{}"'`~|/\\]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 20)
}

function cleanAssistantReply(reply: string) {
  return reply
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\(\s*([^)]+?)\s*\)/g, '$1: $2')
    .trim()
}

function getQuestionTokens(question: string) {
  return question
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"'`~|/\\]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function parseBudget(question: string) {
  const matches = [
    ...question
      .replace(/,/g, '')
      .matchAll(/(?:ไม่เกิน|ต่ำกว่า|งบ|ราคาไม่เกิน|ภายใน)\s*(\d{1,5})|(?:^|\s)(\d{1,5})\s*บาท/gi),
  ]
  const value = matches[0]?.[1] || matches[0]?.[2]
  return value ? Number(value) : null
}

function isOpenOnlyQuestion(question: string) {
  return /เปิดอยู่|ร้านเปิด|ตอนนี้เปิด|ยังเปิด|เปิดตอนนี้/i.test(question)
}

const RESTAURANT_TYPE_PATTERNS: Array<{
  type: RestaurantType
  pattern: RegExp
}> = [
  { type: 'made_to_order', pattern: /ร้าน(?:อาหาร)?ตามสั่ง|อาหารตามสั่ง|เขียนเมนูเอง/i },
  { type: 'rice_menu', pattern: /ร้านราดข้าว|เมนูราดข้าว|ข้าวราดแกง/i },
  { type: 'noodle', pattern: /ร้านก๋วยเตี๋ยว|ก๋วยเตี๋ยว|ร้านบะหมี่|ร้านอาหารเส้น/i },
  { type: 'drink', pattern: /ร้านน้ำ|ร้านเครื่องดื่ม|เครื่องดื่ม|ร้านชา|ร้านกาแฟ/i },
  { type: 'dessert_fruit', pattern: /ร้านขนม|ร้านของหวาน|ร้านผลไม้|ขนมหวาน|ของหวาน/i },
  { type: 'other', pattern: /ร้านประเภทอื่น|ร้านอื่น\s*ๆ/i },
]

function getRequestedRestaurantType(question: string) {
  return RESTAURANT_TYPE_PATTERNS.find(({ pattern }) => pattern.test(question))?.type || null
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, '')
}

function getMentionedRestaurant(question: string, restaurants: RestaurantRow[]) {
  const normalizedQuestion = normalizeSearchText(question)
  return restaurants
    .filter((restaurant) => restaurant.name.trim().length >= 2)
    .sort((a, b) => b.name.length - a.name.length)
    .find((restaurant) => normalizedQuestion.includes(normalizeSearchText(restaurant.name))) || null
}

function buildSearchQuestion(question: string, messages: ChatMessage[]) {
  if (!FOLLOW_UP_PATTERN.test(question)) return question

  const recentContext = messages
    .filter((message) => message.content.trim())
    .slice(-2)
    .map((message) => message.content.slice(0, 500))
    .join(' ')

  return recentContext
    ? `${recentContext} ${question}`
    : question
}

function shouldRecommendRestaurants(question: string) {
  return /ร้าน|แนะนำ|กิน|หิว|อาหาร|เมนู|เปิด|อร่อย|ขาย|ราคา/i.test(question)
}

function buildRestaurantRecommendations(
  question: string,
  restaurants: RestaurantRow[],
  menus: MenuRow[],
  originalQuestion = question,
) {
  if (!shouldRecommendRestaurants(question)) return []

  const tokens = getQuestionTokens(question)
  const budget = parseBudget(question)
  const openOnly = isOpenOnlyQuestion(question)
  const requestedType = getRequestedRestaurantType(question)
  const mentionedRestaurant = getMentionedRestaurant(originalQuestion, restaurants)
  const menusByRestaurant = new Map<string, MenuRow[]>()

  menus.forEach((menu) => {
    const restaurantMenus = menusByRestaurant.get(menu.restaurant_id) || []
    restaurantMenus.push(menu)
    menusByRestaurant.set(menu.restaurant_id, restaurantMenus)
  })

  return restaurants
    .filter((restaurant) => !mentionedRestaurant || restaurant.id === mentionedRestaurant.id)
    .filter((restaurant) => mentionedRestaurant || !requestedType || restaurant.restaurant_type === requestedType)
    .map((restaurant): RestaurantRecommendation & { score: number } => {
      const restaurantMenus = menusByRestaurant.get(restaurant.id) || []
      const availableMenus = restaurantMenus.filter(
        (menu) => menu.is_available && isMenuAvailableOnDay(menu.available_days),
      )
      const affordableMenus = budget === null
        ? availableMenus
        : availableMenus.filter((menu) => Number(menu.price) <= budget)
      const searchable = [
        restaurant.name,
        restaurant.description || '',
        restaurant.address || '',
        restaurant.restaurant_type || '',
        ...restaurantMenus.flatMap((menu) => [menu.name, menu.description || '']),
      ]
        .join(' ')
        .toLowerCase()
      const matchedMenus = affordableMenus
        .filter((menu) => {
          if (budget !== null) return true
          const menuText = `${menu.name} ${menu.description || ''}`.toLowerCase()
          return tokens.some((token) => menuText.includes(token))
        })
        .slice(0, 3)
        .map((menu) => `${menu.name} (${Number(menu.price).toLocaleString('th-TH')} บาท)`)
      const typeMeta = getRestaurantTypeMeta(restaurant.restaurant_type)
      const isOpen = isRestaurantOpenNow(
        restaurant.status,
        restaurant.open_time,
        restaurant.close_time,
      )
      const contactHref = restaurant.phone
        ? `tel:${restaurant.phone.replace(/[^\d+]/g, '')}`
        : restaurant.email
          ? `mailto:${restaurant.email}`
          : '/contact'
      const contactLabel = restaurant.phone
        ? 'โทรหาร้าน'
        : restaurant.email
          ? 'อีเมลร้าน'
          : 'ติดต่อเรา'
      const textScore = tokens.reduce(
        (score, token) => (searchable.includes(token) ? score + 3 : score),
        0,
      )
      const openScore = isOpen ? (openOnly ? 12 : 2) : 0
      const menuScore = matchedMenus.length * 5 + Math.min(availableMenus.length, 8)
      const budgetScore = budget !== null && affordableMenus.length > 0 ? 10 : 0

      return {
        id: restaurant.id,
        name: restaurant.name,
        description: restaurant.description || typeMeta.description,
        href: `/restaurants/${restaurant.id}`,
        menuHref: `/restaurants/${restaurant.id}#menu`,
        contactHref,
        contactLabel,
        imageUrl: restaurant.image_url || '/placeholder.jpg',
        statusLabel: isOpen ? 'เปิดอยู่' : 'ปิดอยู่',
        isOpen,
        hours: formatRestaurantTimeRange(restaurant.open_time, restaurant.close_time),
        typeLabel: typeMeta.label,
        typeIcon: typeMeta.icon,
        availableMenuCount: availableMenus.length,
        matchedMenus,
        score: openScore + menuScore + textScore + budgetScore,
      }
    })
    .filter((restaurant) => !openOnly || restaurant.isOpen)
    .filter((restaurant) => budget === null || restaurant.matchedMenus.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      href: restaurant.href,
      menuHref: restaurant.menuHref,
      contactHref: restaurant.contactHref,
      contactLabel: restaurant.contactLabel,
      imageUrl: restaurant.imageUrl,
      statusLabel: restaurant.statusLabel,
      isOpen: restaurant.isOpen,
      hours: restaurant.hours,
      typeLabel: restaurant.typeLabel,
      typeIcon: restaurant.typeIcon,
      availableMenuCount: restaurant.availableMenuCount,
      matchedMenus: restaurant.matchedMenus,
    }))
}

function buildRecommendationReply(
  question: string,
  recommendations: RestaurantRecommendation[],
) {
  if (recommendations.length === 0) return null

  const budget = parseBudget(question)
  const asksHours = /กี่โมง|เวลาเปิด|เปิดถึง|ปิดกี่โมง/i.test(question)
  const names = recommendations.slice(0, 3).map((restaurant) => restaurant.name)
  if (asksHours) {
    const restaurant = recommendations[0]
    return `${restaurant.name} เปิดเวลา ${restaurant.hours} ครับ`
  }
  const intro = budget !== null
    ? `เจอร้านที่มีเมนูพร้อมขายในงบไม่เกิน ${budget.toLocaleString('th-TH')} บาทครับ`
    : isOpenOnlyQuestion(question)
      ? 'คัดเฉพาะร้านที่เปิดอยู่ตอนนี้ให้แล้วครับ'
      : 'เจอร้านที่น่าจะตรงกับที่ต้องการครับ'

  return `${intro} แนะนำ ${names.join(', ')} กดดูรายละเอียดและเมนูจากการ์ดด้านล่างได้เลยครับ`
}

function buildMissingRestaurantTypeReply(question: string, recommendationCount: number) {
  const requestedType = getRequestedRestaurantType(question)
  if (!requestedType || recommendationCount > 0) return null

  const label = RESTAURANT_TYPES.find((type) => type.value === requestedType)?.label || 'ประเภทนี้'
  return `ตอนนี้ยังไม่พบ${label}ที่ตรงกับเงื่อนไขครับ ลองเปลี่ยนประเภท หรือดูร้านที่เปิดอยู่ทั้งหมดได้ครับ`
}

function buildSuggestedQuestions(
  question: string,
  recommendations: RestaurantRecommendation[],
) {
  if (recommendations.length > 0) {
    const first = recommendations[0]
    return [
      `${first.name} มีเมนูอะไรบ้าง`,
      `${first.name} เปิดถึงกี่โมง`,
      'มีร้านอื่นอีกไหม',
    ]
  }

  if (/สั่ง|ตะกร้า|ชำระ|จ่าย/i.test(question)) {
    return ['ดูร้านที่เปิดอยู่', 'แนะนำเมนูไม่เกิน 60 บาท', 'ติดตามออเดอร์']
  }

  return ['แนะนำร้านที่เปิดอยู่', 'มีเมนูอะไรไม่เกิน 60 บาท', 'วิธีสั่งอาหาร']
}

function buildPersonalOrderReply(matches: AiKnowledgeItem[]) {
  if (matches.length === 0) {
    return 'ยังไม่พบออเดอร์ในบัญชีนี้ครับ หากเพิ่งสั่งอาหาร ลองเปิดหน้าติดตามคำสั่งซื้ออีกครั้ง'
  }

  return `ข้อมูลออเดอร์ล่าสุดของคุณครับ\n${matches
    .slice(0, 3)
    .map((item) => `• ${item.content}`)
    .join('\n')}\n\nดูรายละเอียดทั้งหมดได้ที่หน้าติดตามคำสั่งซื้อครับ`
}

async function askOpenRouter(
  req: NextRequest,
  question: string,
  context: string,
  messages: ChatMessage[],
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || getSiteUrl(req.headers),
      'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME || 'Food Order KMUTNB',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      temperature: 0.25,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nข้อมูลที่ค้นเจอ:\n${context}`,
        },
        ...messages.slice(-8).map((message) => ({
          role: message.role,
          content: message.content.slice(0, 1200),
        })),
        {
          role: 'user',
          content: question,
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('OpenRouter request failed:', response.status, detail.slice(0, 500))
    return null
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  return typeof content === 'string' ? content.trim() : null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const question = String(body?.message || '').trim()

    if (!question || question.length > 1000) {
      return NextResponse.json(
        { error: 'ข้อความต้องมีความยาว 1-1000 ตัวอักษร' },
        { status: 400 },
      )
    }

    const messages: ChatMessage[] = Array.isArray(body?.messages)
      ? body.messages
          .filter((message: unknown): message is ChatMessage => {
            if (!message || typeof message !== 'object') return false
            const candidate = message as Partial<ChatMessage>
            return (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.content === 'string'
          })
          .slice(-10)
          .map((message: ChatMessage) => ({
            role: message.role,
            content: message.content.slice(0, 1200),
          }))
      : []
    const searchQuestion = buildSearchQuestion(question, messages)
    const [storeContext, personalOrderContext] = await Promise.all([
      getStoreContext(),
      getPersonalOrderKnowledge(searchQuestion),
    ])
    if (personalOrderContext.requiresLogin) {
      return NextResponse.json({
        reply: 'กรุณาเข้าสู่ระบบก่อนครับ แล้วผมจะตรวจสถานะออเดอร์ของคุณจาก Supabase ให้ได้ทันที',
        mode: 'local-demo',
        recommendations: [],
        suggestedQuestions: ['วิธีสั่งอาหาร', 'ดูร้านที่เปิดอยู่', 'แนะนำเมนูไม่เกิน 60 บาท'],
        sources: [],
        dataSource: 'supabase',
      })
    }
    const recommendations = buildRestaurantRecommendations(
      searchQuestion,
      storeContext.restaurants,
      storeContext.menus,
      question,
    )
    const allKnowledge = [
      ...STATIC_AI_KNOWLEDGE,
      ...memoryToKnowledge(body?.memories),
      ...storeContext.knowledge,
      ...personalOrderContext.knowledge,
    ]
    const matches = retrieveAiKnowledge(searchQuestion, allKnowledge)
    const recommendationContext = recommendations
      .map((restaurant) => {
        const matchedMenus = restaurant.matchedMenus.length
          ? ` เมนูที่ตรงคำถาม: ${restaurant.matchedMenus.join(', ')}`
          : ''
        return `ร้านแนะนำ ${restaurant.name}: ${restaurant.statusLabel}, เวลา ${restaurant.hours}, ${restaurant.availableMenuCount} เมนูพร้อมขาย, ลิงก์ ${restaurant.href}.${matchedMenus}`
      })
      .join('\n')
    const knowledgeContext = matches.length
      ? matches.map((item) => `${item.title}: ${item.content}`).join('\n')
      : 'ไม่พบข้อมูลที่ตรงกับคำถามนี้'
    const context = [recommendationContext, knowledgeContext].filter(Boolean).join('\n')
    const isPersonalOrderAnswer = personalOrderContext.knowledge.length > 0
    const missingRestaurantTypeReply = buildMissingRestaurantTypeReply(question, recommendations.length)
    const openRouterReply = isPersonalOrderAnswer || missingRestaurantTypeReply
      ? null
      : await askOpenRouter(req, question, context, messages)
    const localRecommendationReply = buildRecommendationReply(question, recommendations)
    const reply = isPersonalOrderAnswer
      ? buildPersonalOrderReply(personalOrderContext.knowledge)
      : missingRestaurantTypeReply || openRouterReply || localRecommendationReply || buildLocalAiReply(question, matches)

    return NextResponse.json({
      reply: cleanAssistantReply(reply),
      mode: openRouterReply ? 'openrouter' : 'local-demo',
      recommendations,
      suggestedQuestions: buildSuggestedQuestions(question, recommendations),
      sources: matches.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        content: item.content,
      })),
      dataSource: storeContext.supabaseConfigured ? 'supabase' : 'local-knowledge',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ระบบแชทมีปัญหาชั่วคราว'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
