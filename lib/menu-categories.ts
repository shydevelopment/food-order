export const DEFAULT_MENU_CATEGORIES: Record<string, string[]> = {
  made_to_order: ['เมนูยอดนิยม', 'ผัด', 'ทอด', 'ต้ม', 'เส้น', 'กับข้าว'],
  rice_menu: ['ราดข้าว', 'กับข้าว', 'เมนูไข่', 'เมนูไก่', 'เมนูหมู', 'เมนูเนื้อ'],
  noodle: ['ก๋วยเตี๋ยว', 'เย็นตาโฟ', 'ต้มยำ', 'น้ำตก', 'แห้ง', 'เกาเหลา'],
  drink: ['น้ำอัดลม', 'น้ำปั่น', 'ชา', 'กาแฟ', 'นม', 'โซดา'],
  dessert_fruit: ['ขนมหวาน', 'ผลไม้', 'น้ำแข็งไส', 'ของทานเล่น', 'เซตพิเศษ'],
  other: ['เมนูแนะนำ', 'ขายดี', 'เซตพิเศษ', 'ของทานเล่น', 'เมนูประจำวัน'],
}

export const getMenuCategorySuggestions = (restaurantType: string | null | undefined) => (
  DEFAULT_MENU_CATEGORIES[restaurantType || ''] || DEFAULT_MENU_CATEGORIES.rice_menu
)

export const getMenuCategoryToneClasses = (index: number) => {
  switch (index % 8) {
    case 0:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    case 1:
      return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
    case 2:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    case 3:
      return 'border-pink-500/30 bg-pink-500/10 text-pink-300'
    case 4:
      return 'border-purple-500/30 bg-purple-500/10 text-purple-300'
    case 5:
      return 'border-orange-500/30 bg-orange-500/10 text-orange-300'
    case 6:
      return 'border-red-500/30 bg-red-500/10 text-red-300'
    default:
      return 'border-lime-500/30 bg-lime-500/10 text-lime-300'
  }
}
