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
      title: 'พื้นที่จัดการสำหรับร้านและแอดมิน',
      body: 'เจ้าของร้านสามารถรับออเดอร์และจัดการข้อมูลร้าน ส่วนผู้ดูแลระบบสามารถจัดการข้อมูลผู้ใช้ ร้านอาหาร และสิทธิ์การเข้าถึงได้',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 text-white">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl md:p-8">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-400">About Us</p>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">Food Order KMUTNB</h1>
        <p className="mt-4 text-sm leading-7 text-neutral-400">
          Food Order KMUTNB คือระบบสั่งอาหารสำหรับนักศึกษา บุคลากร และร้านอาหารภายในมหาวิทยาลัย
          ออกแบบมาเพื่อให้ผู้ใช้ดูร้านและเมนูได้ง่ายขึ้น พร้อมมีระบบสั่งอาหาร ติดตามออเดอร์
          และพื้นที่จัดการสำหรับร้านอาหารกับผู้ดูแลระบบ
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
              <h2 className="text-base font-black text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
