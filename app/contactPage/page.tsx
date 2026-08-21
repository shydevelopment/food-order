import CopyLineButton from '@/components/copy-line-button'

export default function ContactPage() {
  const lineId = '@foodorder-kmutnb'

  const contactButtons = [
    {
      label: 'ติดต่อทาง Email',
      value: 'example@email.kmutnb.ac.th',
      href: 'mailto:example@email.kmutnb.ac.th',
      className: 'border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-black',
    },
    {
      label: 'ติดต่อทาง Facebook',
      value: 'Food Order KMUTNB',
      href: 'https://facebook.com/',
      className: 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-black',
    },
  ]

  const contacts = [
    {
      title: 'ปัญหาการใช้งานเว็บไซต์',
      detail: 'แจ้งปัญหา login, register, ตะกร้า, การสั่งอาหาร หรือการติดตามออเดอร์',
    },
    {
      title: 'ข้อมูลร้านอาหารไม่ถูกต้อง',
      detail: 'แจ้งชื่อร้าน เมนู ราคา เวลาเปิดปิด หรือข้อมูลติดต่อที่ต้องการให้ตรวจสอบ',
    },
    {
      title: 'สิทธิ์ผู้ใช้และร้านอาหาร',
      detail: 'ติดต่อผู้ดูแลระบบเมื่อต้องการตรวจสอบ role หรือสิทธิ์การเข้าถึงร้านอาหาร',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl px-0 py-4 text-white sm:px-4 sm:py-12">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl sm:p-6 md:p-8">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-400">Contact Us</p>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl md:text-4xl">ติดต่อทีม Food Order</h1>
        <p className="mt-4 text-sm leading-7 text-neutral-400">
          หากพบปัญหาในการใช้งาน ข้อมูลร้านอาหารไม่ถูกต้อง หรือมีข้อสงสัยเกี่ยวกับสิทธิ์การใช้งาน
          สามารถติดต่อผู้ดูแลระบบของ Food Order KMUTNB เพื่อให้ช่วยตรวจสอบและแก้ไขได้
        </p>

        <div className="mt-6 space-y-3 md:mt-8 md:space-y-4">
          {contacts.map((item) => (
            <article key={item.title} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
              <h2 className="text-base font-black text-white sm:text-lg">{item.title}</h2>
              <p className="mt-2 text-sm leading-7 text-neutral-400">{item.detail}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 sm:p-5">
          <h2 className="text-base font-black text-orange-400">ข้อมูลที่ควรเตรียมก่อนแจ้งปัญหา</h2>
          <p className="mt-2 text-sm leading-7 text-neutral-400">
            กรุณาแจ้ง username, อีเมล, หน้าที่พบปัญหา, เวลาที่เกิดปัญหา และรายละเอียดสั้น ๆ
            เพื่อให้ผู้ดูแลระบบตรวจสอบได้เร็วขึ้น
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <CopyLineButton lineId={lineId} />

          {contactButtons.map((button) => (
            <a
              key={button.label}
              href={button.href}
              target={button.href.startsWith('http') ? '_blank' : undefined}
              rel={button.href.startsWith('http') ? 'noreferrer' : undefined}
            className={`rounded-xl border px-4 py-4 text-left font-black transition-colors sm:px-5 ${button.className}`}
            >
              <span className="block text-sm">{button.label}</span>
              <span className="mt-1 block text-xs opacity-80">{button.value}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
