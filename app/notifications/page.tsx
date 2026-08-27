import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { createClient } from '@/supabase/service'
import {
  getNotificationFeed,
  type NotificationFeedItem,
} from '@/lib/notification-feed'
import NotificationReadLink from '@/components/notification-read-link'

const formatNotificationTime = (dateString: string) =>
  new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(dateString))

const getToneClasses = (tone: NotificationFeedItem['tone']) => {
  if (tone === 'emerald')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (tone === 'sky') return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  return 'border-orange-500/30 bg-orange-500/10 text-orange-300'
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4 text-white">
        <section className="w-full rounded-3xl border border-neutral-800  p-8 text-center">
          <h1 className="text-2xl font-black text-white">
            กรุณาเข้าสู่ระบบก่อน
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            แจ้งเตือนจะแสดงตามบัญชีของแต่ละคน
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-black text-black transition hover:bg-orange-400"
          >
            เข้าสู่ระบบ
          </Link>
        </section>
      </div>
    )
  }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const feed = await getNotificationFeed(supabaseAdmin, user.id)
  const roleText =
    feed.profile?.role === 'admin'
      ? 'Admin'
      : feed.profile?.role === 'restaurant'
        ? 'Restaurant'
        : 'Customer'

  return (
    <div className="notifications-page min-h-screen text-white">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-0 pb-10 sm:px-2">
        <section className="notifications-hero rounded-3xl border border-neutral-800  p-5 sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">
                {roleText}
              </span>
              <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
                แจ้งเตือนทั้งหมด
              </h1>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                แสดงเฉพาะออเดอร์และข้อความที่เกี่ยวข้องกับบัญชีนี้
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800  px-5 py-4 text-center">
              <p className="text-3xl font-black text-orange-300">
                {feed.items.length}
              </p>
              <p className="text-xs font-bold text-neutral-500">
                รายการทั้งหมด
              </p>
            </div>
          </div>
        </section>

        <section className="notifications-panel rounded-3xl border border-neutral-800  p-3 sm:p-4">
          {feed.items.length === 0 ? (
            <div className="notifications-empty rounded-2xl border border-neutral-800  px-5 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800  text-2xl text-neutral-500">
                ✓
              </div>
              <h2 className="mt-4 text-xl font-black text-white">
                ไม่มีแจ้งเตือนค้างอยู่
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                เมื่อมีออเดอร์หรือข้อความใหม่ จะมาแสดงที่หน้านี้
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {feed.items.map((item) => (
                <NotificationReadLink
                  key={item.id}
                  href={item.href}
                  notificationId={item.id}
                  className={`notifications-item grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-2xl border  p-4 transition hover:border-orange-500/40  ${
                    item.is_active_order
                      ? 'border-orange-500/45 shadow-lg shadow-orange-500/5'
                      : `border-neutral-800 ${item.is_read ? 'opacity-60' : ''}`
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-black ${getToneClasses(item.tone)}`}
                  >
                    {item.type === 'chat' ? 'แชท' : '!'}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate text-base font-black text-white">
                        {item.title}
                      </span>
                      <time className="shrink-0 text-xs font-bold text-neutral-500">
                        {formatNotificationTime(item.created_at)}
                      </time>
                    </span>
                    <span className="mt-1 block line-clamp-2 text-sm leading-6 text-neutral-400">
                      {item.detail}
                    </span>
                  </span>
                </NotificationReadLink>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
