'use client'

import { createBrowserClient } from '@supabase/ssr'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'

const realtimeTables = [
  'orders',
  'order_items',
  'restaurants',
  'menus',
  'profiles',
  'restaurant_members',
  'chat_conversations',
  'chat_messages',
  'notification_sounds',
  'activity_logs',
  'avatars',
  'menu_categories',
]

export default function RealtimeRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  useEffect(() => {
    const isFastRealtimePath = pathname === '/orders' || pathname.startsWith('/admin')

    const scheduleRefresh = () => {
      if (document.visibilityState === 'hidden') return

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }

      refreshTimer.current = setTimeout(() => {
        router.refresh()
      }, 500)
    }

    const channel = realtimeTables
      .reduce((currentChannel, table) => {
        return currentChannel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, scheduleRefresh)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, scheduleRefresh)
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, scheduleRefresh)
      }, supabase.channel(`global-realtime-refresh-${Date.now()}`))
      .subscribe()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (isFastRealtimePath) {
      pollTimer.current = setInterval(scheduleRefresh, 3000)
    }

    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [pathname, router, supabase])

  return null
}
