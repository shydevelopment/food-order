'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import LogoutConfirmButton from './logout-confirm-button'
import ThemeToggle from './theme-toggle'
import { getAccountRoleMeta, isKmutnbStudentEmail } from '@/lib/roles'

interface Profile {
  username: string | null
  full_name: string | null
  avatar_url: string | null
  role: string | null
  email: string | null
}

interface NotificationItem {
  id: string
  type: 'order' | 'chat'
  title: string
  detail: string
  href: string
  tone: 'orange' | 'emerald' | 'sky'
  is_read?: boolean
  is_active_order?: boolean
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)
  const [notificationItems, setNotificationItems] = useState<
    NotificationItem[]
  >([])
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  )

  const pathname = usePathname()

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  )

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, full_name, avatar_url, role, email')
          .eq('id', userId)
          .single()

        if (error) throw error
        if (!data) return

        const nextProfile = data as Profile

        if (
          isKmutnbStudentEmail(nextProfile.email) &&
          !['student', 'admin', 'restaurant'].includes(nextProfile.role || '')
        ) {
          setProfile({ ...nextProfile, role: 'student' })
          const res = await fetch('/api/profile/sync-student-role', {
            method: 'POST',
          })
          const result = await res.json().catch(() => null)
          if (result?.role) {
            setProfile((current) =>
              current ? { ...current, role: result.role } : current,
            )
          }
          return
        }

        setProfile(nextProfile)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Error fetching profile:', message)
      }
    },
    [supabase],
  )

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        await fetchProfile(user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile, pathname, supabase])

  useEffect(() => {
    const syncCartCount = () => {
      try {
        const cart = JSON.parse(
          window.localStorage.getItem('food-order-cart') || '[]',
        ) as Array<{ quantity?: number }>
        setCartCount(
          cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        )
      } catch {
        setCartCount(0)
      }
    }

    syncCartCount()
    window.addEventListener('storage', syncCartCount)
    window.addEventListener('food-order-cart-updated', syncCartCount)

    return () => {
      window.removeEventListener('storage', syncCartCount)
      window.removeEventListener('food-order-cart-updated', syncCartCount)
    }
  }, [pathname])

  useEffect(() => {
    let isMounted = true
    let timer: ReturnType<typeof setInterval> | null = null

    const fetchNotificationCount = async () => {
      if (!user) {
        if (isMounted) setNotificationCount(0)
        return
      }

      try {
        const res = await fetch('/api/notifications')
        const result = await res.json()

        if (!isMounted) return
        if (!res.ok) {
          setNotificationError(result.error || 'โหลดแจ้งเตือนไม่สำเร็จ')
          setNotificationCount(0)
          setNotificationItems([])
          return
        }

        const items = (result.items || []) as NotificationItem[]
        const actionableItems = items.filter(
          (item) => !item.is_read || item.is_active_order,
        )

        setNotificationError(null)
        setNotificationCount(Number(result.count || actionableItems.length))
        setNotificationItems(actionableItems.slice(0, 5))
      } catch {
        if (isMounted) {
          setNotificationError('โหลดแจ้งเตือนไม่สำเร็จ')
          setNotificationCount(0)
          setNotificationItems([])
        }
      }
    }

    void fetchNotificationCount()
    timer = setInterval(() => {
      void fetchNotificationCount()
    }, 30000)

    return () => {
      isMounted = false
      if (timer) clearInterval(timer)
    }
  }, [pathname, user])

  const isAdmin = profile?.role === 'admin'
  const isRestaurantOwner = profile?.role === 'restaurant'
  const profileRoleLabel = profile?.role
    ? getAccountRoleMeta(profile.role)?.thaiLabel || profile.role
    : ''
  const notificationHref = '/notifications'
  const notificationHasItems =
    notificationCount > 0 || notificationItems.length > 0

  const markNotificationRead = (itemId: string) => {
    const selectedItem = notificationItems.find((item) => item.id === itemId)

    if (selectedItem?.is_active_order) {
      setNotificationItems((current) =>
        current.map((item) =>
          item.id === itemId ? { ...item, is_read: true } : item,
        ),
      )
    } else {
      setNotificationItems((current) =>
        current.filter((item) => item.id !== itemId),
      )
      setNotificationCount((current) => Math.max(0, current - 1))
    }

    void fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
      keepalive: true,
    }).catch(() => undefined)
  }

  return (
    <header className="app-chrome bg-neutral-950 text-white shadow-md w-full relative z-50 border-b border-neutral-900">
      <div className="w-full px-3 py-3 flex justify-between items-center gap-2 relative z-20 bg-neutral-950 sm:px-6 sm:gap-3">
        {/* LOGO */}
        <div
          className="relative z-20 min-w-0 shrink text-sm font-black cursor-pointer text-orange-500 tracking-wide transition-transform active:scale-95 truncate sm:text-xl"
          onClick={() => (window.location.href = '/')}
        >
          Food <span className="text-white">Order</span>{' '}
          <span className="hidden min-[390px]:inline">KMUTNB</span> 🍔
        </div>

        {/* DESKTOP NAVIGATION */}
        <nav className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 whitespace-nowrap text-sm font-medium lg:flex">
          <Link
            href="/"
            className={`transition-all active:scale-90 ${pathname === '/' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}
          >
            หน้าแรก
          </Link>

          <Link
            href="/storePage"
            className={`transition-all active:scale-90 ${pathname === '/storePage' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}
          >
            ร้านอาหาร
          </Link>

          {user && (
            <a
              href="/trackorderPage"
              className={`transition-all active:scale-90 ${pathname === '/trackorderPage' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}
            >
              ติดตามคำสั่งซื้อ
            </a>
          )}

          {(isAdmin || isRestaurantOwner) && (
            <a
              href={isAdmin ? '/admin' : '/admin/orders'}
              className="text-red-400 hover:text-red-500 font-bold border border-red-900/50 px-2.5 py-0.5 rounded bg-red-950/20 transition-all active:scale-90 active:bg-red-900/50 text-xs tracking-wide"
            >
              {isAdmin ? '📊 Admin' : '🧾 Restaurant'}
            </a>
          )}
        </nav>

        {/* RIGHT SECTION */}
        <div className="relative z-20 flex shrink-0 items-center gap-1.5 sm:gap-4 lg:gap-6">
          <ThemeToggle />

          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationOpen((current) => !current)}
                className={`relative rounded-full p-1 text-gray-300 transition-all hover:bg-neutral-900 hover:text-orange-500 active:scale-75 ${notificationHasItems ? 'notification-bell-button-active text-orange-400' : ''}`}
                aria-label="แจ้งเตือน"
                aria-expanded={isNotificationOpen}
                title="แจ้งเตือน"
              >
                {notificationHasItems && (
                  <span className="absolute inset-0 rounded-full bg-orange-500/20 notification-bell-pulse" />
                )}
                <svg
                  className={`h-5 w-5 sm:h-6 sm:w-6 ${notificationHasItems ? 'notification-bell-active' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 01-6 0m6 0H9"
                  />
                </svg>
                <span
                  className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-black ${
                    notificationHasItems ? 'bg-orange-500' : 'bg-neutral-600'
                  }`}
                />
                {notificationHasItems && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border border-black bg-orange-500 px-1 text-[10px] font-black text-black">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>

              {isNotificationOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsNotificationOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-3 w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 text-white shadow-2xl shadow-black/40">
                    <div className="border-b border-neutral-800 bg-neutral-950 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-orange-400">
                        แจ้งเตือน
                      </p>
                      <p className="mt-1 text-sm font-bold text-neutral-300">
                        {notificationHasItems
                          ? `มี ${notificationCount} รายการที่ต้องดู`
                          : 'ยังไม่มีรายการใหม่ตอนนี้'}
                      </p>
                    </div>

                    <div className="max-h-80 overflow-y-auto p-2">
                      {notificationError ? (
                        <div className="px-4 py-8 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 text-lg font-black text-orange-300">
                            !
                          </div>
                          <p className="mt-3 text-sm font-bold text-neutral-300">
                            ยังโหลดแจ้งเตือนไม่ได้
                          </p>
                          <p className="mt-1 text-xs leading-5 text-neutral-500">
                            {notificationError}
                          </p>
                        </div>
                      ) : notificationItems.length > 0 ? (
                        notificationItems.map((item) => (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => {
                              markNotificationRead(item.id)
                              setIsNotificationOpen(false)
                            }}
                            className={`grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-xl px-3 py-3 transition hover:bg-neutral-800 ${
                              item.is_active_order
                                ? 'border border-orange-500/30 bg-orange-500/10'
                                : ''
                            }`}
                          >
                            <span
                              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-black ${
                                item.tone === 'emerald'
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                  : item.tone === 'sky'
                                    ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                                    : 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                              }`}
                            >
                              {item.type === 'chat' ? 'แชท' : '!'}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-white">
                                {item.title}
                              </span>
                              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-neutral-400">
                                {item.detail}
                              </span>
                            </span>
                          </Link>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950 text-lg text-neutral-500">
                            ✓
                          </div>
                          <p className="mt-3 text-sm font-bold text-neutral-300">
                            ไม่มีแจ้งเตือนค้างอยู่
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            ถ้ามีออเดอร์หรือสถานะใหม่ จะแสดงตรงนี้
                          </p>
                        </div>
                      )}
                    </div>

                    <Link
                      href={notificationHref}
                      onClick={() => setIsNotificationOpen(false)}
                      className="block border-t border-neutral-800 px-4 py-3 text-center text-sm font-black text-orange-400 transition hover:bg-neutral-800 hover:text-orange-300"
                    >
                      ดูทั้งหมด
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* CART ICON */}
          {user && (
            <a
              href="/cartPage"
              className="relative text-gray-300 hover:text-orange-500 transition-all active:scale-75 p-1 group"
            >
              <svg
                className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 sm:h-6 sm:w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-black text-[10px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center border border-black animate-pulse">
                  {cartCount}
                </span>
              )}
            </a>
          )}

          {/* USER PROFILE / LOGIN BUTTONS (Desktop) */}
          {loading ? (
            <div
              className="hidden h-9 w-24 animate-pulse rounded-full bg-neutral-900 md:block"
              aria-label="กำลังตรวจสอบบัญชี"
            />
          ) : user ? (
            <div className="relative hidden lg:block">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center space-x-3 hover:text-orange-500 transition-all active:scale-95 focus:outline-none cursor-pointer group"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="รูปโปรไฟล์"
                    className="w-8 h-8 rounded-full border border-orange-500 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm font-bold text-black">
                    {(profile?.full_name || profile?.username || user.email)
                      ?.charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className="text-sm text-left">
                  <span className="block font-medium group-hover:text-orange-400 transition-colors">
                    {profile?.full_name || profile?.username || user.email}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 group-hover:text-orange-500 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsMenuOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-gray-200 shadow-2xl z-20">
                    <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950 rounded-t-lg">
                      <p className="text-[10px] text-gray-500 font-bold tracking-wider uppercase mb-1">
                        บัญชีของคุณ
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm font-bold text-orange-500 truncate">
                          @
                          {profile?.username ||
                            profile?.full_name ||
                            'username'}
                        </p>
                        {profile?.role && (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide
 ${
   profile.role === 'admin'
     ? 'bg-red-500/20 text-red-500 border border-red-500/50'
     : profile.role === 'restaurant'
       ? 'bg-orange-500/20 text-orange-500 border border-orange-500/50'
       : profile.role === 'student'
         ? 'bg-white/10 text-white border border-white/40'
         : profile.role === 'rider'
           ? 'bg-green-500/20 text-green-500 border border-green-500/50'
           : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
 }`}
                          >
                            {profileRoleLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {user?.email}
                      </p>
                    </div>

                    <a
                      href="/viewProfile"
                      className="block px-4 py-2 text-sm hover:bg-neutral-800 hover:text-orange-400 transition-colors active:bg-neutral-700"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      👤 ดูโปรไฟล์
                    </a>
                    <a
                      href="/editPage"
                      className="block px-4 py-2 text-sm hover:bg-neutral-800 hover:text-orange-400 transition-colors active:bg-neutral-700"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      ⚙️ แก้ไขโปรไฟล์
                    </a>
                    <hr className="border-neutral-800 my-1" />
                    <LogoutConfirmButton
                      context={
                        isAdmin
                          ? 'admin'
                          : isRestaurantOwner
                            ? 'restaurant'
                            : 'default'
                      }
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950/30 font-medium transition-colors active:bg-red-900/50 cursor-pointer"
                    >
                      🚪 ออกจากระบบ
                    </LogoutConfirmButton>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ถ้ายังไม่ได้เข้าสู่ระบบ แสดงปุ่มเข้าสู่ระบบ / สมัครสมาชิกบนคอม */
            <div className="hidden lg:flex space-x-3">
              <a
                href="/login"
                className="text-gray-300 hover:text-orange-400 text-sm transition-all active:scale-95 flex items-center"
              >
                เข้าสู่ระบบ
              </a>
              <a
                href="/register"
                className="bg-orange-500 hover:bg-orange-600 text-black font-bold text-sm px-4 py-2 rounded-md transition-all active:scale-95 shadow-md shadow-orange-500/10"
              >
                สมัครสมาชิก
              </a>
            </div>
          )}

          {/* HAMBURGER BUTTON */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden relative h-8 w-8 shrink-0 text-gray-300 hover:text-orange-500 focus:outline-none transition-all active:scale-75 duration-300"
            aria-label="เปิดปิดเมนู"
          >
            <svg
              className={`absolute top-0.5 left-0.5 w-7 h-7 transition-all duration-300 transform ${isMobileMenuOpen ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>

            <svg
              className={`absolute top-0.5 left-0.5 w-7 h-7 text-orange-500 transition-all duration-300 transform ${isMobileMenuOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 📌 MOBILE DRAWER / MENU */}
      <div
        className={`lg:hidden grid transition-[grid-template-rows,opacity] duration-300 ease-in-out absolute w-full left-0 bg-neutral-950 z-10 shadow-2xl ${
          isMobileMenuOpen
            ? 'grid-rows-[1fr] opacity-100 border-b border-neutral-900'
            : 'grid-rows-[0fr] opacity-0 border-transparent'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 py-5 border-t border-neutral-900 sm:px-6">
            {loading ? (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900" />
                <div className="h-10 animate-pulse rounded-lg bg-neutral-900" />
                <div className="h-10 animate-pulse rounded-lg bg-neutral-900" />
              </div>
            ) : user ? (
              /* กรณีเข้าสู่ระบบแล้ว: แสดงโปรไฟล์ + เมนูนำทาง + บัญชีผู้ใช้ */
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-neutral-900 rounded-xl border border-neutral-800 mb-2 transition-transform active:scale-[0.98]">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="รูปโปรไฟล์"
                      className="w-10 h-10 rounded-full border border-orange-500 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold text-black text-lg">
                      {(profile?.full_name || profile?.username || user.email)
                        ?.charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">
                      {profile?.full_name || profile?.username || user.email}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-orange-400 truncate">
                        @{profile?.username || 'user'}
                      </span>
                      {profile?.role && (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${
                            profile.role === 'student'
                              ? 'bg-white/10 text-white border-white/40'
                              : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                          }`}
                        >
                          {profileRoleLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <nav className="flex flex-col space-y-3 font-medium text-base">
                  <Link
                    href="/"
                    className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    🏠 หน้าแรก
                  </Link>
                  <Link
                    href="/storePage"
                    className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/storePage' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    🍔 ร้านอาหาร
                  </Link>
                  <a
                    href="/trackorderPage"
                    className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/trackorderPage' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    📍 ติดตามคำสั่งซื้อ
                  </a>
                  {(isAdmin || isRestaurantOwner) && (
                    <a
                      href={isAdmin ? '/admin' : '/admin/orders'}
                      className="p-2 rounded-lg text-red-400 bg-red-950/30 border border-red-900/50 font-bold flex items-center gap-2 transition-all active:scale-95 active:bg-red-900/50"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {isAdmin ? '📊 Admin Dashboard' : '🧾 Restaurant Orders'}
                    </a>
                  )}
                </nav>

                <hr className="border-neutral-900 my-2" />

                <div className="space-y-2 pt-1">
                  <a
                    href="/viewProfile"
                    className="block p-2 rounded-lg text-sm text-gray-300 hover:bg-neutral-900 hover:text-orange-400 transition-all active:scale-95 active:bg-neutral-800"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    👤 ดูโปรไฟล์
                  </a>
                  <a
                    href="/editPage"
                    className="block p-2 rounded-lg text-sm text-gray-300 hover:bg-neutral-900 hover:text-orange-400 transition-all active:scale-95 active:bg-neutral-800"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    ⚙️ แก้ไขโปรไฟล์
                  </a>
                  <LogoutConfirmButton
                    context={
                      isAdmin
                        ? 'admin'
                        : isRestaurantOwner
                          ? 'restaurant'
                          : 'default'
                    }
                    onBeforeOpen={() => setIsMobileMenuOpen(false)}
                    className="w-full text-left p-2 rounded-lg text-sm font-bold text-red-400 bg-red-950/20 hover:bg-red-900/40 transition-all active:scale-95 active:bg-red-900/60"
                  >
                    🚪 ออกจากระบบ
                  </LogoutConfirmButton>
                </div>
              </div>
            ) : (
              /* กรณียังไม่เข้าสู่ระบบ: เปิดให้ดูเว็บและร้านอาหารได้ แต่ยังไม่ให้สั่งอาหาร */
              <div className="flex flex-col space-y-3">
                <Link
                  href="/"
                  className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  🏠 หน้าแรก
                </Link>
                <Link
                  href="/storePage"
                  className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/storePage' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  🍔 ร้านอาหาร
                </Link>
                <hr className="border-neutral-900 my-1" />
                <a
                  href="/login"
                  className="w-full text-center py-2.5 text-gray-300 hover:text-orange-400 text-sm font-semibold rounded-lg border border-neutral-800 transition-all active:scale-95 active:bg-neutral-900"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  เข้าสู่ระบบ
                </a>
                <a
                  href="/register"
                  className="w-full text-center py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-bold text-sm rounded-lg transition-all active:scale-95 active:bg-orange-700 shadow-md shadow-orange-500/10"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  สมัครสมาชิก
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
