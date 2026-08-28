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
import { getRestaurantTypeMeta } from '@/lib/restaurant-types'

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
}

type MenuRow = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  price: number | string
  is_available: boolean | null
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
ถ้าผู้ใช้ถามวิธีทำ chatbot หรือการเทรน ให้แนะนำแบบ RAG + memory ก่อน fine-tuning
เมื่อแนะนำร้านอาหาร ให้ตอบสั้น ๆ แบบเป็นธรรมชาติ และบอกผู้ใช้ว่ากดการ์ดร้านด้านล่างเพื่อเข้าหน้าร้านได้ ไม่ต้องเขียน markdown link เอง`

function createReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  return createSupabaseClient(url, key, {
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
}

async function getStoreContext(): Promise<StoreContext> {
  const supabase = createReadClient()
  if (!supabase) {
    return {
      knowledge: [],
      restaurants: [],
      menus: [],
    }
  }

  const [{ data: restaurants }, { data: menus }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, description, image_url, email, phone, address, status, open_time, close_time, restaurant_type')
      .limit(20),
    supabase
      .from('menus')
      .select('id, restaurant_id, name, description, price, is_available')
      .limit(80),
  ])

  const restaurantRows = (restaurants || []) as RestaurantRow[]
  const menuRows = (menus || []) as MenuRow[]
  const restaurantById = new Map(restaurantRows.map((restaurant) => [restaurant.id, restaurant]))

  const restaurantKnowledge = restaurantRows.map((restaurant): AiKnowledgeItem => {
    const hours = formatRestaurantTimeRange(restaurant.open_time, restaurant.close_time)
    const status = restaurant.status === 'open' ? 'เปิดอยู่' : restaurant.status === 'closed' ? 'ปิดอยู่' : 'ยังไม่ระบุสถานะ'

    return {
      id: `restaurant-${restaurant.id}`,
      title: restaurant.name,
      category: 'restaurant',
      content: `ร้าน ${restaurant.name} ${status} เวลา ${hours}${restaurant.address ? ` ที่อยู่ ${restaurant.address}` : ''}${restaurant.description ? ` รายละเอียด ${restaurant.description}` : ''}`,
      keywords: [
        restaurant.name,
        restaurant.address || '',
        restaurant.description || '',
        'ร้าน',
        'เปิด',
        'ปิด',
        'เวลา',
      ].filter(Boolean),
    }
  })

  const menuKnowledge = menuRows.map((menu): AiKnowledgeItem => {
    const restaurant = restaurantById.get(menu.restaurant_id)
    const availability = menu.is_available ? 'พร้อมขาย' : 'อาจหมดหรือยังไม่พร้อมขาย'

    return {
      id: `menu-${menu.id}`,
      title: menu.name,
      category: 'menu',
      content: `${menu.name} ราคา ${Number(menu.price).toLocaleString('th-TH')} บาท ${availability}${restaurant ? ` จากร้าน ${restaurant.name}` : ''}${menu.description ? ` รายละเอียด ${menu.description}` : ''}`,
      keywords: [
        menu.name,
        menu.description || '',
        restaurant?.name || '',
        'เมนู',
        'อาหาร',
        'ราคา',
        'บาท',
      ].filter(Boolean),
    }
  })

  return {
    knowledge: [...restaurantKnowledge, ...menuKnowledge],
    restaurants: restaurantRows,
    menus: menuRows,
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

function shouldRecommendRestaurants(question: string) {
  return /ร้าน|แนะนำ|กิน|หิว|อาหาร|เมนู|เปิด|อร่อย|ขาย|ราคา/i.test(question)
}

function buildRestaurantRecommendations(
  question: string,
  restaurants: RestaurantRow[],
  menus: MenuRow[],
) {
  if (!shouldRecommendRestaurants(question)) return []

  const tokens = getQuestionTokens(question)
  const menusByRestaurant = new Map<string, MenuRow[]>()

  menus.forEach((menu) => {
    const restaurantMenus = menusByRestaurant.get(menu.restaurant_id) || []
    restaurantMenus.push(menu)
    menusByRestaurant.set(menu.restaurant_id, restaurantMenus)
  })

  return restaurants
    .map((restaurant): RestaurantRecommendation & { score: number } => {
      const restaurantMenus = menusByRestaurant.get(restaurant.id) || []
      const availableMenus = restaurantMenus.filter((menu) => menu.is_available)
      const searchable = [
        restaurant.name,
        restaurant.description || '',
        restaurant.address || '',
        restaurant.restaurant_type || '',
        ...restaurantMenus.flatMap((menu) => [menu.name, menu.description || '']),
      ]
        .join(' ')
        .toLowerCase()
      const matchedMenus = availableMenus
        .filter((menu) => {
          const menuText = `${menu.name} ${menu.description || ''}`.toLowerCase()
          return tokens.some((token) => menuText.includes(token))
        })
        .slice(0, 3)
        .map((menu) => menu.name)
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
          : '/contactPage'
      const contactLabel = restaurant.phone
        ? 'โทรหาร้าน'
        : restaurant.email
          ? 'อีเมลร้าน'
          : 'ติดต่อเรา'
      const textScore = tokens.reduce(
        (score, token) => (searchable.includes(token) ? score + 3 : score),
        0,
      )
      const openScore = isOpen ? 8 : 0
      const menuScore = matchedMenus.length * 5 + Math.min(availableMenus.length, 8)

      return {
        id: restaurant.id,
        name: restaurant.name,
        description: restaurant.description || typeMeta.description,
        href: `/storePage/${restaurant.id}`,
        menuHref: `/storePage/${restaurant.id}#menu`,
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
        score: openScore + menuScore + textScore,
      }
    })
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

    const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : []
    const storeContext = await getStoreContext()
    const recommendations = buildRestaurantRecommendations(
      question,
      storeContext.restaurants,
      storeContext.menus,
    )
    const allKnowledge = [
      ...STATIC_AI_KNOWLEDGE,
      ...memoryToKnowledge(body?.memories),
      ...storeContext.knowledge,
    ]
    const matches = retrieveAiKnowledge(question, allKnowledge)
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
    const openRouterReply = await askOpenRouter(req, question, context, messages)
    const reply = recommendations.length > 0
      ? 'แนะนำร้านที่เหมาะให้แล้วครับ กดการ์ดด้านล่างเพื่อเข้าหน้าร้านได้เลย'
      : openRouterReply || buildLocalAiReply(question, matches)

    return NextResponse.json({
      reply: cleanAssistantReply(reply),
      mode: openRouterReply ? 'openrouter' : 'local-demo',
      recommendations,
      sources: matches.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        content: item.content,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ระบบแชทมีปัญหาชั่วคราว'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
