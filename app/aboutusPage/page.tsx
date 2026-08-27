export default function AboutUsPage() {
  const highlights = [
    {
      title: 'ดูร้านและเมนูได้ทันที',
      body: 'ผู้ใช้ที่ยังไม่ได้สมัครสมาชิกสามารถเปิดดูร้านอาหาร เวลาเปิดปิด ราคา และรายการเมนูได้ก่อนตัดสินใจ',
    },
    {
      title: 'สั่งอาหารหลังเข้าสู่ระบบ',
      body: 'เมื่อลงทะเบียนหรือเข้าสู่ระบบแล้ว ผู้ใช้จะสามารถเพิ่มเมนูลงตะกร้า สั่งอาหาร และติดตามสถานะออเดอร์ได้',
    },
    {
      title: 'พื้นที่จัดการสำหรับร้านและ Admin',
      body: 'Owner สามารถรับออเดอร์และจัดการข้อมูลร้าน ส่วน Admin สามารถจัดการข้อมูลผู้ใช้ ร้านอาหาร และสิทธิ์การเข้าถึงได้',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl px-0 py-4 text-white sm:px-4 sm:py-12">
      <section className="rounded-2xl border border-neutral-800  p-4 shadow-2xl sm:p-6 md:p-8">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-400">เกี่ยวกับเรา</p>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl md:text-4xl">ฟู้ดออเดอร์ KMUTNB</h1>
        <p className="mt-4 text-sm leading-7 text-neutral-400">
          ฟู้ดออเดอร์ KMUTNB คือระบบสั่งอาหารสำหรับนักศึกษา บุคลากร และร้านอาหารภายในมหาวิทยาลัย
          ออกแบบมาเพื่อให้ผู้ใช้ดูร้านและเมนูได้ง่ายขึ้น พร้อมมีระบบสั่งอาหาร ติดตามออเดอร์
          และพื้นที่จัดการสำหรับร้านอาหารกับ Admin
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 md:mt-8 md:grid-cols-3 md:gap-4">
          {highlights.map((item) => (
            <article key={item.title} className="rounded-xl border border-neutral-800  p-4 sm:p-5">
              <h2 className="text-base font-black text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
