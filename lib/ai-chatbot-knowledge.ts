export type AiKnowledgeCategory =
  | 'menu'
  | 'restaurant'
  | 'ordering'
  | 'delivery'
  | 'payment'
  | 'policy'
  | 'memory'
  | 'order'

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
    keywords: ['สั่ง', 'สั่งอาหาร', 'ออเดอร์', 'ตะกร้า', 'ซื้อ', 'order', 'วิธีซื้อ', 'ขั้นตอนสั่ง'],
  },
  {
    id: 'login-before-order',
    title: 'การเข้าสู่ระบบก่อนสั่ง',
    category: 'ordering',
    content:
      'ลูกค้าดูร้านอาหารได้ทันที แต่ต้องเข้าสู่ระบบก่อนสั่งอาหาร ติดตามคำสั่งซื้อ หรือใช้งานข้อมูลบัญชี',
    keywords: ['login', 'ล็อกอิน', 'เข้าสู่ระบบ', 'สมัคร', 'บัญชี', 'สั่งไม่ได้', 'เข้าใช้', 'เข้าระบบ'],
  },
  {
    id: 'track-order',
    title: 'ติดตามคำสั่งซื้อ',
    category: 'delivery',
    content:
      'เมื่อลูกค้าสั่งอาหารแล้ว สามารถติดตามสถานะได้ที่หน้า ติดตามคำสั่งซื้อ ระบบจะแจ้งเตือนเมื่อสถานะอัปเดต',
    keywords: ['ติดตาม', 'สถานะ', 'คำสั่งซื้อ', 'ออเดอร์', 'แจ้งเตือน', 'ออเดอร์ถึงไหน', 'เช็กออเดอร์'],
  },
  {
    id: 'payment-flow',
    title: 'การชำระเงิน',
    category: 'payment',
    content:
      'คำสั่งซื้อจะสรุปราคาในหน้าตะกร้าก่อนเข้าสู่ขั้นตอนชำระเงิน หากข้อมูลไม่ครบควรกลับไปตรวจตะกร้าก่อน',
    keywords: ['จ่าย', 'จ่ายเงิน', 'ชำระ', 'ชำระเงิน', 'ราคา', 'ยอดรวม', 'โอน', 'เงินสด', 'คิดเงิน'],
  },
  {
    id: 'bot-memory',
    title: 'ความจำของแชทบอท',
    category: 'memory',
    content:
      'ถ้าผู้ใช้พิมพ์ขึ้นต้นว่า จำไว้ว่า ระบบจะบันทึกข้อความนั้นไว้ในเครื่องผู้ใช้และส่งเป็นบริบทให้บอทในการถามครั้งถัดไป',
    keywords: ['จำไว้ว่า', 'จำ', 'เรียนรู้', 'เทรน', 'memory', 'train', 'จำข้อมูล', 'บันทึกความจำ'],
  },
  {
    id: 'safe-learning',
    title: 'หลักการเรียนรู้จากแชท',
    category: 'policy',
    content:
      'ระบบไม่ควรเอาทุกแชทไปเทรนโมเดลอัตโนมัติทันที ควรเก็บเป็น memory หรือ knowledge base ก่อน แล้วให้ผู้ดูแลตรวจคำตอบที่ดีค่อยนำไป fine-tune',
    keywords: ['เทรน', 'เรียนเอง', 'fine-tune', 'ปรับโมเดล', 'ข้อมูลผิด', 'ตอบไม่ตรง', 'เพิ่มความฉลาด'],
  },
]

const QUERY_ALIASES: Record<string, string[]> = {
  'เปิดถึง': ['เวลาเปิด', 'ปิดกี่โมง', 'เวลาร้าน', 'ชั่วโมงเปิด'],
  'เปิดอยู่': ['ร้านเปิด', 'ตอนนี้เปิด', 'ยังเปิด', 'เปิดรับออเดอร์'],
  'ปิดอยู่': ['ร้านปิด', 'ปิดแล้ว', 'ยังไม่เปิด'],
  'เมนู': ['อาหาร', 'ของกิน', 'รายการอาหาร', 'มีอะไรบ้าง', 'สั่งอะไรดี'],
  'แนะนำ': ['หาร้าน', 'ช่วยเลือก', 'น่ากิน', 'ร้านไหนดี', 'มีร้านไหน'],
  'ร้านน้ำ': ['เครื่องดื่ม', 'ชา', 'กาแฟ', 'น้ำปั่น', 'ร้านกาแฟ'],
  'ร้านตามสั่ง': ['อาหารตามสั่ง', 'ผัดกะเพรา', 'ข้าวผัด'],
  'ราดข้าว': ['ข้าวราดแกง', 'กับข้าว', 'ข้าวแกง'],
  'ก๋วยเตี๋ยว': ['ก๋วยจั๊บ', 'บะหมี่', 'อาหารเส้น'],
  'ขนม': ['ของหวาน', 'ผลไม้', 'ของทานเล่น', 'ไอศกรีม'],
  'ไม่เกิน': ['งบ', 'ราคาต่ำกว่า', 'ราคาไม่เกิน', 'บาท', 'ประหยัด'],
  'ถูก': ['ราคาถูก', 'ประหยัด', 'คุ้ม'],
  'แพ้': ['ไม่กิน', 'ทานไม่ได้', 'แพ้อาหาร', 'วัตถุดิบ', 'ส่วนผสม'],
  'วันนี้': ['ขายวันนี้', 'วันขาย', 'เมนูวันนี้'],
  'พรุ่งนี้': ['วันพรุ่งนี้', 'ขายพรุ่งนี้'],
  'รับอาหาร': ['เวลารับ', 'ไปรับ', 'นัดรับ', 'pickup'],
  'ออเดอร์': ['คำสั่งซื้อ', 'รายการสั่งซื้อ', 'order'],
  'ยกเลิก': ['ยกเลิกออเดอร์', 'cancel'],
  'หิว': ['อยากกิน', 'หาอะไรกิน', 'กินอะไรดี', 'ของกิน'],
  'อร่อย': ['เด็ด', 'น่ากิน', 'แนะนำเมนู', 'เมนูยอดนิยม'],
  'เผ็ด': ['ไม่เผ็ด', 'เผ็ดน้อย', 'เผ็ดมาก', 'พริก'],
  'เจ': ['มังสวิรัติ', 'vegan', 'vegetarian', 'ไม่มีเนื้อสัตว์'],
  'ฮาลาล': ['halal', 'อาหารมุสลิม'],
  'ไก่': ['chicken', 'เนื้อไก่'],
  'หมู': ['pork', 'เนื้อหมู'],
  'เนื้อ': ['beef', 'เนื้อวัว'],
  'กุ้ง': ['shrimp', 'ปู', 'ทะเล', 'ซีฟู้ด', 'seafood'],
  'มื้อเช้า': ['อาหารเช้า', 'ตอนเช้า', 'breakfast'],
  'มื้อกลางวัน': ['อาหารกลางวัน', 'เที่ยง', 'lunch'],
  'มื้อเย็น': ['อาหารเย็น', 'เย็นนี้', 'dinner'],
  'ของทานเล่น': ['ขนมกินเล่น', 'ของว่าง', 'snack'],
  'ใกล้': ['ใกล้ฉัน', 'แถวนี้', 'บริเวณนี้', 'ที่อยู่', 'พิกัด'],
  'โทร': ['เบอร์โทร', 'โทรศัพท์', 'ติดต่อร้าน', 'contact'],
  'แจ้งเตือน': ['notification', 'เตือนออเดอร์', 'ข้อความแจ้งเตือน'],
  'รอร้านรับ': ['รอรับออเดอร์', 'รอยืนยัน', 'pending'],
  'กำลังเตรียม': ['ทำอาหารอยู่', 'กำลังทำ', 'preparing'],
  'พร้อมรับ': ['รับได้แล้ว', 'อาหารเสร็จแล้ว', 'พร้อมให้รับ', 'delivering'],
  'เสร็จสิ้น': ['สำเร็จแล้ว', 'completed', 'ได้รับแล้ว'],
  'ลืมรหัส': ['รหัสผ่าน', 'เปลี่ยนรหัส', 'forgot password'],
}

const STOP_WORDS = new Set([
  'มี', 'ไหม', 'หน่อย', 'ครับ', 'ค่ะ', 'คะ', 'ครับผม', 'ช่วย', 'ให้', 'ที่', 'ของ', 'และ',
  'หรือ', 'อะไร', 'บ้าง', 'ตอนนี้', 'ได้', 'เลย', 'ขอ', 'อยาก', 'หน่อยครับ', 'ร้าน',
])

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s\u200b]+/g, '').trim()
}

function tokenize(value: string) {
  const spacedTokens = value
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"'`~|/\\]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))

  // Thai text is often written without spaces. Keep meaningful short phrases too.
  const compact = normalize(value)
  const phraseTokens = Array.from(new Set(
    [4, 5].flatMap((size) => Array.from({ length: Math.max(0, compact.length - size + 1) }, (_, index) => compact.slice(index, index + size))),
  )).filter((token) => /[ก-๙a-z0-9]/i.test(token))

  return Array.from(new Set([...spacedTokens, ...phraseTokens]))
}

function expandQuestionKeywords(question: string) {
  const compactQuestion = normalize(question)
  const aliases = Object.entries(QUERY_ALIASES).flatMap(([trigger, values]) => {
    const compactTrigger = normalize(trigger)
    return compactQuestion.includes(compactTrigger) ? [trigger, ...values] : []
  })

  return Array.from(new Set([...tokenize(question), ...aliases]))
}

function getEditDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = left[row - 1] === right[column - 1]
        ? previous[column - 1]
        : Math.min(previous[column - 1] + 1, previous[column] + 1, current[column - 1] + 1)
    }
    for (let column = 0; column <= right.length; column += 1) previous[column] = current[column]
  }
  return previous[right.length]
}

function hasTypoTolerantMatch(keyword: string, questionTokens: string[]) {
  // Only apply fuzzy matching to Latin words to avoid false positives in Thai text.
  if (!/^[a-z0-9]+$/i.test(keyword) || keyword.length < 4) return false
  return questionTokens.some((token) => {
    if (!/^[a-z0-9]+$/i.test(token) || token.length < 4) return false
    return Math.max(keyword.length, token.length) <= 10 && getEditDistance(keyword, token) <= 1
  })
}

export function retrieveAiKnowledge(
  question: string,
  knowledgeItems: AiKnowledgeItem[],
  limit = 6,
) {
  const normalizedQuestion = normalize(question)
  const questionTokens = expandQuestionKeywords(question)

  return knowledgeItems
    .map((item) => {
      const searchableText = normalize(
        [item.title, item.category, item.content, ...item.keywords].join(' '),
      )
      const uniqueKeywords = Array.from(new Set(item.keywords.map(normalize).filter(Boolean)))
      const keywordScore = uniqueKeywords.reduce((score, keyword) => {
        if (!normalizedQuestion.includes(keyword) && !hasTypoTolerantMatch(keyword, questionTokens)) return score

        return score + (normalizedQuestion.includes(keyword) ? 5 : 2) + Math.min(keyword.length, 18)
      }, 0)
      const tokenScore = questionTokens.reduce((score, token) => {
        return searchableText.includes(normalize(token)) ? score + (token.length >= 4 ? 2 : 1) : score
      }, 0)
      const titleScore = normalize(item.title) && normalizedQuestion.includes(normalize(item.title)) ? 14 : 0
      const intentScore = item.category === 'restaurant' && /ร้าน|เปิด|ปิด|เวลา|หา|แนะนำ/i.test(question)
        ? 4
        : item.category === 'menu' && /เมนู|อาหาร|กิน|หิว|ราคา|บาท|งบ/i.test(question)
          ? 4
          : item.category === 'ordering' && /สั่ง|ซื้อ|ตะกร้า/i.test(question)
            ? 5
            : item.category === 'delivery' && /ติดตาม|สถานะ|ถึงไหน/i.test(question)
              ? 5
              : item.category === 'payment' && /จ่าย|ชำระ|โอน|ยอด/i.test(question)
                ? 5
                : item.category === 'order' && /ออเดอร์|คำสั่งซื้อ|สถานะ|รับอาหาร|ยกเลิก/i.test(question)
                  ? 7
                : 0
      const memoryIntentScore =
        item.category === 'memory' && /ฉัน|ผม|เรา|ของฉัน|ของผม|ชอบ|จำ|เคย/i.test(question)
          ? 8
          : 0

      return {
        ...item,
        score: keywordScore + tokenScore + titleScore + intentScore + memoryIntentScore,
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
