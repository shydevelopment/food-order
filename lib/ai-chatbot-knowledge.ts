export type AiKnowledgeCategory =
  | 'menu'
  | 'restaurant'
  | 'ordering'
  | 'delivery'
  | 'payment'
  | 'policy'
  | 'memory'

export type AiKnowledgeItem = {
  id: string
  title: string
  category: AiKnowledgeCategory
  content: string
  keywords: string[]
}

export type AiKnowledgeMatch = AiKnowledgeItem & {
  score: number
}

export const STATIC_AI_KNOWLEDGE: AiKnowledgeItem[] = [
  {
    id: 'how-to-order',
    title: 'วิธีสั่งอาหาร',
    category: 'ordering',
    content:
      'ลูกค้าสามารถเลือกดูร้านจากหน้า ร้านอาหาร เลือกเมนู ใส่ตะกร้า แล้วไปที่ตะกร้าเพื่อยืนยันคำสั่งซื้อ',
    keywords: ['สั่ง', 'สั่งอาหาร', 'ออเดอร์', 'ตะกร้า', 'ซื้อ', 'order'],
  },
  {
    id: 'login-before-order',
    title: 'การเข้าสู่ระบบก่อนสั่ง',
    category: 'ordering',
    content:
      'ลูกค้าดูร้านอาหารได้ทันที แต่ต้องเข้าสู่ระบบก่อนสั่งอาหาร ติดตามคำสั่งซื้อ หรือใช้งานข้อมูลบัญชี',
    keywords: ['login', 'ล็อกอิน', 'เข้าสู่ระบบ', 'สมัคร', 'บัญชี', 'สั่งไม่ได้'],
  },
  {
    id: 'track-order',
    title: 'ติดตามคำสั่งซื้อ',
    category: 'delivery',
    content:
      'เมื่อลูกค้าสั่งอาหารแล้ว สามารถติดตามสถานะได้ที่หน้า ติดตามคำสั่งซื้อ ระบบจะแจ้งเตือนเมื่อสถานะอัปเดต',
    keywords: ['ติดตาม', 'สถานะ', 'คำสั่งซื้อ', 'ออเดอร์', 'แจ้งเตือน'],
  },
  {
    id: 'payment-flow',
    title: 'การชำระเงิน',
    category: 'payment',
    content:
      'คำสั่งซื้อจะสรุปราคาในหน้าตะกร้าก่อนเข้าสู่ขั้นตอนชำระเงิน หากข้อมูลไม่ครบควรกลับไปตรวจตะกร้าก่อน',
    keywords: ['จ่าย', 'จ่ายเงิน', 'ชำระ', 'ชำระเงิน', 'ราคา', 'ยอดรวม'],
  },
  {
    id: 'bot-memory',
    title: 'ความจำของแชทบอท',
    category: 'memory',
    content:
      'ถ้าผู้ใช้พิมพ์ขึ้นต้นว่า จำไว้ว่า ระบบจะบันทึกข้อความนั้นไว้ในเครื่องผู้ใช้และส่งเป็นบริบทให้บอทในการถามครั้งถัดไป',
    keywords: ['จำไว้ว่า', 'จำ', 'เรียนรู้', 'เทรน', 'memory', 'train'],
  },
  {
    id: 'safe-learning',
    title: 'หลักการเรียนรู้จากแชท',
    category: 'policy',
    content:
      'ระบบไม่ควรเอาทุกแชทไปเทรนโมเดลอัตโนมัติทันที ควรเก็บเป็น memory หรือ knowledge base ก่อน แล้วให้ผู้ดูแลตรวจคำตอบที่ดีค่อยนำไป fine-tune',
    keywords: ['เทรน', 'เรียนเอง', 'fine-tune', 'ปรับโมเดล', 'ข้อมูลผิด'],
  },
]

function normalize(value: string) {
  return value.toLowerCase().trim()
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[\s,.;:!?()[\]{}"'`~|/\\]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

export function retrieveAiKnowledge(
  question: string,
  knowledgeItems: AiKnowledgeItem[],
  limit = 6,
) {
  const normalizedQuestion = normalize(question)
  const questionTokens = tokenize(question)

  return knowledgeItems
    .map((item) => {
      const searchableText = normalize(
        [item.title, item.category, item.content, ...item.keywords].join(' '),
      )
      const keywordScore = item.keywords.reduce((score, keyword) => {
        const normalizedKeyword = normalize(keyword)
        if (!normalizedQuestion.includes(normalizedKeyword)) return score

        return score + 3 + Math.min(normalizedKeyword.length, 14)
      }, 0)
      const tokenScore = questionTokens.reduce((score, token) => {
        return searchableText.includes(token) ? score + 1 : score
      }, 0)
      const memoryIntentScore =
        item.category === 'memory' && /ฉัน|ผม|เรา|ของฉัน|ของผม|ชอบ|จำ|เคย/i.test(question)
          ? 8
          : 0

      return {
        ...item,
        score: keywordScore + tokenScore + memoryIntentScore,
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function buildLocalAiReply(question: string, matches: AiKnowledgeMatch[]) {
  if (matches.length === 0) {
    return 'ตอนนี้ยังไม่เจอข้อมูลที่ตรงกับคำถามนี้ในฐานข้อมูลครับ ลองถามเรื่องร้านอาหาร เมนู ราคา วิธีสั่งอาหาร การชำระเงิน หรือพิมพ์ว่า "จำไว้ว่า ..." เพื่อสอนข้อมูลใหม่ให้บอทจำในเครื่องนี้'
  }

  const hasOrderIntent = /สั่ง|ซื้อ|เอา|ขอ|order/i.test(question)
  const asksHowToOrder = /วิธี|ยังไง|อย่างไร|ทำไง|ทำอย่างไร|ขั้นตอน/i.test(question)
  const menuMatches = matches.filter((item) => item.category === 'menu')
  const guideMatches = matches.filter((item) => item.category !== 'menu')

  if (asksHowToOrder && guideMatches.length > 0) {
    return guideMatches.map((item) => item.content).join('\n')
  }

  if (hasOrderIntent && !asksHowToOrder && menuMatches.length > 0) {
    return `${menuMatches
      .map((item) => item.content)
      .join('\n')}\n\nถ้าจะสั่งจริง ให้กดเข้าร้านอาหาร เลือกเมนู แล้วเพิ่มลงตะกร้าครับ`
  }

  return matches.map((item) => item.content).join('\n')
}
