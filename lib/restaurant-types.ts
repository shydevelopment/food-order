export const RESTAURANT_TYPES = [
  {
    value: 'made_to_order',
    label: 'ร้านตามสั่ง',
    description: 'ลูกค้าเขียนเมนูเอง เลือกพิเศษ และร้านจัดการวัตถุดิบหมดได้',
    icon: '🍳',
  },
  {
    value: 'rice_menu',
    label: 'เมนูราดข้าว',
    description: 'ร้านจัดเมนูรายวัน ลูกค้าเลือกเมนูและติ๊กพิเศษได้',
    icon: '🍛',
  },
  {
    value: 'noodle',
    label: 'ร้านก๋วยเตี๋ยว',
    description: 'ร้านจัดเมนูก๋วยเตี๋ยวรายวัน ลูกค้าเลือกเมนู ติ๊กพิเศษ และเลือกเวลารับได้',
    icon: '🍜',
  },
  {
    value: 'drink',
    label: 'ร้านน้ำ',
    description: 'ร้านจัดเมนูเครื่องดื่มให้ลูกค้าเลือก',
    icon: '🧋',
  },
  {
    value: 'dessert_fruit',
    label: 'ร้านขนมหวานผลไม้',
    description: 'ร้านจัดเมนูขนมหวานหรือผลไม้รายวัน และปิดเมนูที่หมดได้',
    icon: '🍧',
  },
  {
    value: 'other',
    label: 'ร้านอื่น ๆ',
    description: 'ร้านประเภทอื่นที่จัดเมนูให้ลูกค้าเลือกและกำหนดวันขายได้',
    icon: '🏪',
  },
] as const

export type RestaurantType = typeof RESTAURANT_TYPES[number]['value']

export const RESTAURANT_TYPE_VALUES = RESTAURANT_TYPES.map((type) => type.value)

export const DEFAULT_RESTAURANT_TYPE: RestaurantType = 'rice_menu'

export const getRestaurantTypeMeta = (type: string | null | undefined) => (
  RESTAURANT_TYPES.find((item) => item.value === type) || RESTAURANT_TYPES[1]
)

export const supportsSpecialOption = (type: string | null | undefined) => (
  type === 'made_to_order' || type === 'rice_menu' || type === 'noodle'
)

export const supportsCustomMenuText = (type: string | null | undefined) => (
  type === 'made_to_order'
)

export const supportsIngredientAvailability = (type: string | null | undefined) => (
  type === 'made_to_order' || type === 'noodle'
)

export const COMMON_INGREDIENTS = [
  'ไก่',
  'หมู',
  'หมูกรอบ',
  'ปลา',
  'เนื้อ',
  'ลูกชิ้น',
  'ตับ',
  'เส้นเล็ก',
  'เส้นหมี่',
  'บะหมี่',
  'กุ้ง',
  'ปลาหมึก',
  'ไข่',
  'ผัก',
]
