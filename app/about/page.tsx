import Image from 'next/image'
import FlaticonIcon from '@/components/flaticon-icon'
import nattapoomPhoto from '@/img/aboutus/nattapoom.jpg'
import teamPhoto from '@/img/aboutus/witchakorn.jpg'

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
    <div className="mx-auto max-w-4xl space-y-6 px-0 py-4 text-white sm:px-4 sm:py-12">
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
      <section aria-labelledby="developer-team" className="space-y-6">
        <h2 id="developer-team" className="text-center text-3xl font-bold uppercase tracking-wide text-amber-400">
          Team Shydev
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-amber-500/20 bg-neutral-950/70 p-5 text-center shadow-2xl shadow-amber-950/10 sm:p-6">
            <div className="mx-auto mt-5 aspect-square w-full max-w-56 overflow-hidden rounded-2xl border border-amber-500/30 bg-neutral-900 shadow-xl shadow-amber-950/20">
              <Image
                src={nattapoomPhoto}
                alt="Nattapoom Wilawan ผู้พัฒนาระบบ Food Order KMUTNB"
                className="h-full w-full object-cover"
                priority={false}
              />
            </div>

            <h3 className="mt-6 text-2xl font-black text-white">Nattapoom Wilawan</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Full Stack Developer</p>

            <div className="mt-6 border-t border-neutral-800 pt-5">
              <p className="text-sm font-black text-amber-300">ช่องทางติดต่อ</p>
              <div className="mt-3 flex justify-center gap-3">
                <a
                  href="https://www.instagram.com/ranahtfai"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram ของ Nattapoom Wilawan"
                  title="Instagram"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10 text-xl text-pink-300 transition hover:border-pink-400 hover:bg-pink-500 hover:text-white active:scale-95"
                >
                  <FlaticonIcon name="instagram" prefix="fi-brands" className="h-5 w-5" />
                </a>
                <a
                  href="https://line.me/ti/p/~nayoki_ma"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LINE ของ Nattapoom Wilawan"
                  title="LINE"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 text-xl text-green-300 transition hover:border-green-400 hover:bg-green-500 hover:text-white active:scale-95"
                >
                  <FlaticonIcon name="line" prefix="fi-brands" className="h-5 w-5" />
                </a>
                <a
                  href="https://www.facebook.com/shykrachet"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook ของ Nattapoom Wilawan"
                  title="Facebook"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xl text-blue-300 transition hover:border-blue-400 hover:bg-blue-500 hover:text-white active:scale-95"
                >
                  <FlaticonIcon name="facebook" prefix="fi-brands" className="h-5 w-5" />
                </a>
                <a
                  href="https://github.com/shykrachet"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub ของ Nattapoom Wilawan"
                  title="GitHub"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-600 bg-neutral-800/60 text-xl text-neutral-200 transition hover:border-white hover:bg-white hover:text-neutral-950 active:scale-95"
                >
                  <FlaticonIcon name="github" prefix="fi-brands" className="h-5 w-5" />
                </a>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-amber-500/20 bg-neutral-950/70 p-5 text-center shadow-2xl shadow-amber-950/10 sm:p-6">
            <div className="mx-auto mt-5 aspect-square w-full max-w-56 overflow-hidden rounded-2xl border border-amber-500/30 bg-neutral-900 shadow-xl shadow-amber-950/20">
              <Image
                src={teamPhoto}
                alt="Witchakorn Bunthum ผู้พัฒนาระบบ Food Order KMUTNB"
                className="h-full w-full object-cover"
                priority={false}
              />
            </div>

            <h3 className="mt-6 text-2xl font-black text-white">Witchakorn Bunthum</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Web Designer / Frontend Developer</p>

            <div className="mt-6 border-t border-neutral-800 pt-5">
              <p className="text-sm font-black text-amber-300">ช่องทางติดต่อ</p>
              <div className="mt-3 flex justify-center gap-3">
                <a
                  href="https://www.instagram.com/realpunuy/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram ของ Witchakorn Bunthum"
                  title="Instagram"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10 text-xl text-pink-300 transition hover:border-pink-400 hover:bg-pink-500 hover:text-white active:scale-95"
                >
                  <FlaticonIcon name="instagram" prefix="fi-brands" className="h-5 w-5" />
                </a>
                <a
                  href="https://github.com/Punuy"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub ของ Witchakorn Bunthum"
                  title="GitHub"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-600 bg-neutral-800/60 text-xl text-neutral-200 transition hover:border-white hover:bg-white hover:text-neutral-950 active:scale-95"
                >
                  <FlaticonIcon name="github" prefix="fi-brands" className="h-5 w-5" />
                </a>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
