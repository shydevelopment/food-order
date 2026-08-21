'use client'

import { useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type LogoutContext = 'default' | 'admin' | 'restaurant'

interface LogoutConfirmButtonProps {
  children: React.ReactNode
  className?: string
  context?: LogoutContext
  redirectTo?: string
  onBeforeOpen?: () => void
}

const modalCopy = {
  default: {
    title: 'ยืนยันออกจากระบบ',
    description: 'คุณกำลังจะออกจากระบบ ระบบจะตัดการเชื่อมต่อเซสชันปัจจุบัน',
    confirm: 'ยืนยัน / ออกจากระบบ',
    badge: 'ออกจากระบบ',
  },
  admin: {
    title: 'ยืนยันออกจากระบบ',
    description: 'คุณกำลังจะออกจากระบบ ระบบจะตัดการเชื่อมต่อเซสชันปัจจุบัน',
    confirm: 'ยืนยัน / ออกจากระบบ',
    badge: 'ออกจากระบบ',
  },
  restaurant: {
    title: 'ยืนยันออกจากระบบ',
    description: 'คุณกำลังจะออกจากระบบ ระบบจะตัดการเชื่อมต่อเซสชันปัจจุบัน',
    confirm: 'ยืนยัน / ออกจากระบบ',
    badge: 'ออกจากระบบ',
  },
}

export default function LogoutConfirmButton({
  children,
  className,
  context = 'default',
  redirectTo = '/',
  onBeforeOpen,
}: LogoutConfirmButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const copy = modalCopy[context]

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  const openModal = () => {
    onBeforeOpen?.()
    setIsOpen(true)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    window.location.href = redirectTo
  }

  return (
    <>
      <button type="button" onClick={openModal} className={className}>
        {children}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-3xl">
              ⚠️
            </div>

            <p className="mt-4 text-xs font-black uppercase tracking-wide text-orange-400">{copy.badge}</p>
            <h2 className="mt-2 text-2xl font-black text-white">{copy.title}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-6 text-neutral-300">
              {copy.description}
            </p>

            <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-left text-xs font-bold leading-6 text-neutral-300">
              <p><span className="mr-2 text-amber-400">•</span>ระบบจะออกจากบัญชีนี้ทันทีหลังยืนยัน</p>
              <p><span className="mr-2 text-amber-400">•</span>หากต้องการใช้งานต่อ ต้องเข้าสู่ระบบใหม่อีกครั้ง</p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-black shadow-lg shadow-orange-500/10 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? 'กำลังออกจากระบบ...' : copy.confirm}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isLoggingOut}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
