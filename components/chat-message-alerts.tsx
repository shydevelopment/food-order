'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useMemo, useRef, useState } from 'react'

interface ChatAlert {
  id: string
  body: string
  order_id: string | null
  order_no: number | null
  restaurant_name: string | null
  sender_name: string
  target_path: string
}

export default function ChatMessageAlerts() {
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCheckedAt = useRef(new Date().toISOString())
  const shownMessageIds = useRef<Set<string>>(new Set())
  const [chatAlert, setChatAlert] = useState<ChatAlert | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  useEffect(() => {
    let isMounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const closeAlert = () => {
      setIsClosing(true)
      window.setTimeout(() => {
        setChatAlert(null)
        setIsClosing(false)
      }, 180)
    }

    const showChatAlert = (message: ChatAlert) => {
      if (shownMessageIds.current.has(message.id)) return

      shownMessageIds.current.add(message.id)
      setIsClosing(false)
      setChatAlert(message)

      if (alertTimer.current) {
        clearTimeout(alertTimer.current)
      }

      alertTimer.current = setTimeout(closeAlert, 7000)
    }

    const fetchRecentMessages = async () => {
      if (document.visibilityState === 'hidden') return

      try {
        const res = await fetch(`/api/chats/recent?since=${encodeURIComponent(lastCheckedAt.current)}`)
        const result = await res.json()

        if (!isMounted || !res.ok) return

        const messages = (result.messages || []) as ChatAlert[]
        const newestMessage = messages.find((message) => !shownMessageIds.current.has(message.id))

        if (newestMessage) {
          showChatAlert(newestMessage)
        }

        if (typeof result.checkedAt === 'string') {
          lastCheckedAt.current = result.checkedAt
        } else {
          lastCheckedAt.current = new Date().toISOString()
        }
      } catch {
        return
      }
    }

    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!isMounted || !user) return

      lastCheckedAt.current = new Date().toISOString()
      pollTimer.current = setInterval(() => {
        void fetchRecentMessages()
      }, 3000)

      channel = supabase
        .channel(`global-chat-alerts-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
          void fetchRecentMessages()
        })
        .subscribe()
    }

    void start()

    return () => {
      isMounted = false
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
      }
      if (alertTimer.current) {
        clearTimeout(alertTimer.current)
      }
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  if (!chatAlert) return null

  const closeAlert = () => {
    setIsClosing(true)
    window.setTimeout(() => {
      setChatAlert(null)
      setIsClosing(false)
    }, 180)
  }

  return (
    <div className={`fixed right-4 top-20 z-[997] w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-white shadow-2xl shadow-black/50 ${isClosing ? 'food-alert-card--exit' : 'food-alert-card'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-500/40 bg-orange-500/10 text-lg font-black text-orange-400">
          !
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wide text-orange-400">ข้อความใหม่</p>
          <h2 className="mt-1 truncate text-base font-black text-white">
            {chatAlert.sender_name}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-300">{chatAlert.body}</p>
          <p className="mt-2 text-xs font-bold text-neutral-500">
            Order #{chatAlert.order_no || chatAlert.order_id?.slice(0, 8) || '-'}
            {chatAlert.restaurant_name ? ` · ${chatAlert.restaurant_name}` : ''}
          </p>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <a
              href={chatAlert.target_path}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-center text-sm font-black text-black transition hover:bg-orange-400"
            >
              เปิดแชท
            </a>
            <button
              type="button"
              onClick={closeAlert}
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm font-bold text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
