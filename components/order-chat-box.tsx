'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useMemo, useRef, useState } from 'react'

interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
}

interface OrderChatBoxProps {
  orderId: string
  title: string
}

export default function OrderChatBox({ orderId, title }: OrderChatBoxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  useEffect(() => {
    if (!isOpen) return

    const loadMessages = async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const res = await fetch(`/api/chats?orderId=${orderId}`)
        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || 'โหลดแชทไม่สำเร็จ')
        }

        setConversationId(result.conversation.id)
        setCurrentUserId(result.currentUserId)
        setMessages(result.messages || [])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'โหลดแชทไม่สำเร็จ'
        setErrorMessage(message)
      } finally {
        setLoading(false)
      }
    }

    void loadMessages()
  }, [isOpen, orderId])

  useEffect(() => {
    if (!isOpen || !conversationId) return

    const channel = supabase
      .channel(`order-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const nextMessage = payload.new as ChatMessage
          setMessages((current) => (
            current.some((message) => message.id === nextMessage.id)
              ? current
              : [...current, nextMessage]
          ))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, isOpen, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = messageInput.trim()

    if (!body) return

    setSending(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, message: body }),
      })
      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'ส่งข้อความไม่สำเร็จ')
      }

      setMessageInput('')
      setMessages((current) => (
        current.some((message) => message.id === result.message.id)
          ? current
          : [...current, result.message]
      ))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ส่งข้อความไม่สำเร็จ'
      setErrorMessage(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-neutral-900"
      >
        <span className="min-w-0">
          <span className="block text-sm font-black text-white">{title}</span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            {messages.length > 0 ? `${messages.length} ข้อความ` : 'เปิดแชทกับคู่สนทนา'}
          </span>
        </span>
        <span className={`text-xs text-orange-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="border-t border-neutral-800 p-3">
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-xl bg-neutral-900 p-4 text-center text-sm text-neutral-400">กำลังโหลดแชท...</div>
            ) : messages.length === 0 ? (
              <div className="rounded-xl bg-neutral-900 p-4 text-center text-sm text-neutral-400">ยังไม่มีข้อความ</div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.sender_id === currentUserId

                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                      isOwnMessage
                        ? 'bg-orange-500 text-black'
                        : 'border border-neutral-800 bg-neutral-900 text-neutral-200'
                    }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={`mt-1 text-[10px] ${isOwnMessage ? 'text-black/60' : 'text-neutral-500'}`}>
                        {new Date(message.created_at).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {errorMessage && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400">
              {errorMessage}
            </div>
          )}

          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <input
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              maxLength={500}
              placeholder="พิมพ์ข้อความ..."
              className="min-w-0 flex-1 rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={sending || !messageInput.trim()}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-black transition hover:bg-orange-400 disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              {sending ? 'ส่ง...' : 'ส่ง'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
