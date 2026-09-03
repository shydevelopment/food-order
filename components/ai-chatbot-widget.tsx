'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, WheelEvent } from 'react'

type ChatMode = 'openrouter' | 'local-demo'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode?: ChatMode
  recommendations?: RestaurantRecommendation[]
  sources?: Array<{
    id: string
    title: string
    category: string
    content: string
  }>
  suggestedQuestions?: string[]
}

type RestaurantRecommendation = {
  id: string
  name: string
  description: string
  href: string
  menuHref: string
  contactHref: string
  contactLabel: string
  imageUrl: string
  statusLabel: string
  isOpen: boolean
  hours: string
  typeLabel: string
  typeIcon: string
  availableMenuCount: number
  matchedMenus: string[]
}

const MEMORY_STORAGE_KEY = 'food-order-ai-chatbot-memories'
const STARTER_QUESTIONS = [
  'ดูเมนู',
  'แนะนำร้าน',
  'ร้านเปิดอยู่',
  'วิธีสั่ง',
]

function createMessageId() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function loadMemories() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MEMORY_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 12) : []
  } catch {
    return []
  }
}

export default function AiChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'สวัสดีครับ 👋 บอกผมได้เลยว่าอยากกินอะไร มีงบเท่าไหร่ หรืออยากหาร้านที่เปิดอยู่ตอนนี้',
      mode: 'local-demo',
      suggestedQuestions: STARTER_QUESTIONS,
    },
  ])
  const [input, setInput] = useState('')
  const [memories, setMemories] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    return loadMemories()
  })
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const suggestionsScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [isOpen, messages])

  useEffect(() => {
    if (!isOpen) return
    window.setTimeout(() => inputRef.current?.focus(), 120)
  }, [isOpen])

  function saveMemory(note: string, currentMessages: ChatMessage[]) {
    const nextMemories = [note, ...memories.filter((item) => item !== note)].slice(0, 12)
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(nextMemories))
    setMemories(nextMemories)
    setMessages([
      ...currentMessages,
      {
        id: createMessageId(),
        role: 'assistant',
        content: `จำไว้แล้วครับ: ${note}`,
        mode: 'local-demo',
        sources: [
          {
            id: 'local-memory',
            title: 'ความจำในเครื่องนี้',
            category: 'memory',
            content: note,
          },
        ],
      },
    ])
  }

  async function sendMessage(messageText = input) {
    const trimmed = messageText.trim()
    if (!trimmed || isSending) return

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmed,
    }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput('')
    setErrorMessage(null)

    const memoryMatch = trimmed.match(/^จำไว้ว่า\s+(.+)/i)
    if (memoryMatch?.[1]) {
      saveMemory(memoryMatch[1].trim(), nextMessages)
      return
    }

    setIsSending(true)

    try {
      const response = await fetch('/api/ai-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          memories,
          messages: messages.map(({ role, content }) => ({ role, content })),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'ส่งข้อความไม่สำเร็จ')
      }

      setMessages([
        ...nextMessages,
        {
          id: createMessageId(),
          role: 'assistant',
          content: result.reply,
          mode: result.mode,
          recommendations: result.recommendations || [],
          sources: result.sources || [],
          suggestedQuestions: result.suggestedQuestions || [],
        },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ส่งข้อความไม่สำเร็จ'
      setErrorMessage(message)
      setMessages([
        ...nextMessages,
        {
          id: createMessageId(),
          role: 'assistant',
          content: message,
          mode: 'local-demo',
        },
      ])
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage()
  }

  function clearMemories() {
    window.localStorage.removeItem(MEMORY_STORAGE_KEY)
    setMemories([])
  }

  const latestSuggestions = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.suggestedQuestions?.length)
    ?.suggestedQuestions || STARTER_QUESTIONS

  function handleSuggestionWheel(event: WheelEvent<HTMLDivElement>) {
    const scroller = suggestionsScrollRef.current
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return

    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
    if (!delta) return

    event.preventDefault()
    scroller.scrollLeft += delta
  }

  return (
    <div className="fixed bottom-3 right-3 z-[80] sm:bottom-5 sm:right-5">
      {isOpen && (
        <section className="ai-chat-panel flex h-[calc(100dvh-1.5rem)] max-h-[620px] w-[calc(100vw-1.5rem)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-white shadow-2xl shadow-black/45 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:max-h-none sm:w-[420px]">
          <header className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-black px-3.5 py-3 sm:px-4">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-black text-white">AI CHATBOT</h2>
                <span className="home-brand-badge shrink-0 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-black text-orange-300">
                  AI
                </span>
              </div>
              <p className="mt-0.5 text-xs font-bold text-neutral-500">
                ค้นหาร้าน เมนู และราคา
                {memories.length > 0 ? ` · จำ ${memories.length} รายการ` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {memories.length > 0 && (
                <button
                  type="button"
                  onClick={clearMemories}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-neutral-400 transition hover:border-red-500/50 hover:text-red-400 active:scale-90"
                  title="ล้างความจำ"
                  aria-label="ล้างความจำ"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 7h12M9 7V5h6v2m-8 3l1 9h8l1-9" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-neutral-400 transition hover:border-orange-500/50 hover:text-orange-300 active:scale-90"
                title="ปิดแชท"
                aria-label="ปิดแชท"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </header>

          <div aria-live="polite" aria-busy={isSending} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`ai-chat-message flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2.5 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-orange-500 text-black'
                      : 'border border-neutral-800 bg-neutral-900 text-neutral-100'
                  }`}
                >
                  {message.content}
                </div>

                {message.role === 'assistant' && Boolean(message.recommendations?.length) && (
                  <div className="mt-2 grid w-full gap-2">
                    {message.recommendations?.map((restaurant) => (
                      <article
                        key={restaurant.id}
                        className="ai-chat-restaurant-card group grid min-h-[112px] grid-cols-[92px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 text-left shadow-lg shadow-black/20 transition hover:border-orange-500/60 hover:bg-neutral-800 active:scale-[0.99]"
                      >
                        <span
                          className="relative block h-full min-h-[112px] bg-neutral-800 bg-cover bg-center"
                          style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
                        >
                          <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
                            {restaurant.typeIcon}
                          </span>
                        </span>
                        <span className="min-w-0 p-3">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-black text-white group-hover:text-orange-300">
                              {restaurant.name}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                                restaurant.isOpen
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-red-500/15 text-red-300'
                              }`}
                            >
                              {restaurant.statusLabel}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-400">
                            {restaurant.description}
                          </span>
                          <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                            <span className="rounded-full border border-neutral-800 px-2 py-1">
                              {restaurant.hours}
                            </span>
                            <span className="rounded-full border border-neutral-800 px-2 py-1">
                              {restaurant.availableMenuCount} เมนู
                            </span>
                          </span>
                          {restaurant.matchedMenus.length > 0 && (
                            <span className="mt-2 block truncate text-[11px] font-bold text-orange-300">
                              เมนูเด่น: {restaurant.matchedMenus.join(', ')}
                            </span>
                          )}
                          <span className="mt-3 grid grid-cols-2 gap-2">
                            <a
                              href={restaurant.menuHref || restaurant.href}
                              className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-black transition hover:bg-orange-400 active:scale-95"
                            >
                              ดูเมนู
                            </a>
                            <a
                              href={restaurant.contactHref}
                              title={restaurant.contactLabel}
                              aria-label={`${restaurant.contactLabel} ${restaurant.name}`}
                              className="inline-flex items-center justify-center rounded-xl border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 transition hover:border-orange-500/70 hover:text-orange-300 active:scale-95"
                            >
                              ติดต่อ
                            </a>
                          </span>
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="ai-chat-message rounded-2xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-400">
                  <span className="mr-2">กำลังค้นข้อมูล</span>
                  <span className="ai-chat-typing-dot" />
                  <span className="ai-chat-typing-dot" />
                  <span className="ai-chat-typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {errorMessage && (
            <div className="border-t border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
              {errorMessage}
            </div>
          )}

          <footer className="border-t border-neutral-800 bg-black p-2.5 sm:p-3">
            <div className="ai-chat-suggestions-shell mb-2 min-w-0">
              <div
                ref={suggestionsScrollRef}
                onWheel={handleSuggestionWheel}
                className="ai-chat-suggestions-scroll scrollbar-hide flex max-w-full touch-pan-x select-none gap-2 overflow-x-auto overscroll-x-contain pb-1 pr-5"
              >
                {latestSuggestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    disabled={isSending}
                    className="ai-chat-suggestion shrink-0 rounded-full border border-neutral-800 px-2.5 py-1.5 text-xs font-bold text-neutral-300 transition hover:border-orange-500/50 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={1000}
                placeholder="พิมพ์ถาม หรือ จำไว้ว่า ..."
                className="min-w-0 flex-1 rounded-2xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-orange-500 sm:py-2.5"
              />
              <a
                href="/contactPage"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-300 transition hover:border-orange-500/70 hover:bg-orange-500 hover:text-black active:scale-90 sm:h-11 sm:w-11"
                title="ติดต่อ"
                aria-label="ติดต่อ"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
                </svg>
              </a>
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="ai-chat-send-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-black transition hover:bg-orange-400 active:scale-90 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 sm:h-11 sm:w-11"
                title="ส่งข้อความ"
                aria-label="ส่งข้อความ"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h13m0 0l-5-5m5 5l-5 5" />
                </svg>
              </button>
            </form>
          </footer>
        </section>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="ai-chat-launcher relative flex h-16 w-16 items-center justify-center rounded-full border border-orange-300/50 bg-orange-500 text-black shadow-2xl shadow-orange-950/40 ring-4 ring-black/30 transition hover:bg-orange-400 active:scale-95"
          title="เปิดแชท AI"
          aria-label="เปิดแชท AI"
          aria-expanded={isOpen}
        >
          <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 11.3C4 7.3 7.6 4 12 4s8 3.3 8 7.3-3.6 7.3-8 7.3c-.9 0-1.7-.1-2.5-.4l-3.4 1.5c-.7.3-1.4-.4-1.1-1.1l1.2-2.9A6.7 6.7 0 0 1 4 11.3Z" />
          </svg>
          <span className="ai-chat-badge absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-neutral-950 bg-neutral-950 text-orange-400 shadow-lg shadow-black/40">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M8 7h8M8 11h8M8 15h5M6 3h12a2 2 0 012 2v14l-3-2H6a2 2 0 01-2-2V5a2 2 0 012-2Z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}
