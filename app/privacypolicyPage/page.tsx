export default function PrivacyPolicyPage() {
  const sections = [
    {
      title: '1. ข้อมูลที่ระบบจัดเก็บ',
      body: 'ระบบอาจจัดเก็บข้อมูลบัญชี เช่น ชื่อผู้ใช้ ชื่อจริง อีเมล เบอร์โทรศัพท์ รูปโปรไฟล์ บทบาทของผู้ใช้ รวมถึงข้อมูลคำสั่งซื้อและรายการอาหารที่เกี่ยวข้องกับบัญชีของคุณ',
    },
    {
      title: '2. การใช้ข้อมูล',
      body: 'ข้อมูลจะถูกใช้เพื่อยืนยันตัวตน แสดงข้อมูลบัญชี จัดการตะกร้า สร้างคำสั่งซื้อ ติดตามสถานะออเดอร์ และกำหนดสิทธิ์การเข้าถึงหน้าต่าง ๆ ของระบบ',
    },
    {
      title: '3. ข้อมูลร้านอาหารและเมนู',
      body: 'ข้อมูลร้านอาหารและเมนูเป็นข้อมูลที่ผู้ใช้ทั่วไปสามารถดูได้โดยไม่ต้องเข้าสู่ระบบ แต่การสั่งอาหารหรือดูข้อมูลคำสั่งซื้อของตนเองจำเป็นต้องเข้าสู่ระบบก่อน',
    },
    {
      title: '4. การเข้าถึงข้อมูลตามสิทธิ์',
      body: 'ผู้ดูแลระบบสามารถดูข้อมูลที่จำเป็นต่อการจัดการระบบ เจ้าของร้านและพนักงานร้านจะเข้าถึงข้อมูลออเดอร์เฉพาะร้านที่ได้รับสิทธิ์เท่านั้น',
    },
    {
      title: '5. การรักษาความปลอดภัย',
      body: 'ระบบใช้ Supabase สำหรับการยืนยันตัวตนและจัดการข้อมูล ผู้ใช้ควรเก็บรหัสผ่านไว้เป็นความลับ และออกจากระบบเมื่อใช้งานบนอุปกรณ์สาธารณะ',
    },
    {
      title: '6. การแก้ไขข้อมูลส่วนตัว',
      body: 'ผู้ใช้สามารถแก้ไขข้อมูลโปรไฟล์ของตนเองได้ในหน้าบัญชี หากพบข้อมูลผิดพลาดหรือมีข้อสงสัยเกี่ยวกับข้อมูลส่วนตัว สามารถติดต่อผู้ดูแลระบบได้',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 text-white">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl md:p-8">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-400">Privacy Policy</p>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">นโยบายความเป็นส่วนตัว</h1>
        <p className="mt-4 text-sm leading-7 text-neutral-400">
          นโยบายนี้อธิบายว่าระบบ Food Order KMUTNB จัดเก็บ ใช้งาน และปกป้องข้อมูลของผู้ใช้อย่างไร
          เพื่อให้การใช้งานระบบสั่งอาหารเป็นไปอย่างปลอดภัยและโปร่งใส
        </p>

        <div className="mt-8 space-y-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
              <h2 className="text-lg font-black text-white">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-neutral-400">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
