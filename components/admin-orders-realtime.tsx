'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

export default function AdminOrdersRealtime() {
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }

      refreshTimer.current = setTimeout(() => {
        setLastUpdatedAt(new Date())
        router.refresh()
      }, 450)
    }

    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, scheduleRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, scheduleRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'order_items' }, scheduleRefresh)
      .subscribe()

    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }
      supabase.removeChannel(channel)
    }
  }, [router, supabase])

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
      <span className="font-bold text-emerald-400">Realtime</span>
      <span className="ml-1 text-neutral-300">
        {lastUpdatedAt
          ? `อัปเดตล่าสุด ${lastUpdatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
          : 'กำลังฟังออเดอร์ใหม่'}
      </span>
    </div>
  )
}
