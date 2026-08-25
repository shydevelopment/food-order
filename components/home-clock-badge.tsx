'use client'

import { useEffect, useState } from 'react'

const formatBangkokTime = () => (
  new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
)

export default function HomeClockBadge() {
  const [time, setTime] = useState(formatBangkokTime)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(formatBangkokTime())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <span className="home-clock-badge inline-flex min-w-[108px] items-center justify-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-300">
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
      <time className="w-[62px] text-center [font-variant-numeric:tabular-nums]">{time}</time>
    </span>
  )
}
