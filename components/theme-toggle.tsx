'use client'

import { useState } from 'react'

type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'food-order-theme'

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

function getInitialTheme(): ThemeMode {
  if (typeof document !== 'undefined') {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  }

  return 'dark'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const isLight = theme === 'light'

  const toggleTheme = () => {
    const nextTheme: ThemeMode = isLight ? 'dark' : 'light'

    applyTheme(nextTheme)
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    setTheme(nextTheme)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'เปลี่ยนเป็นธีมดำ' : 'เปลี่ยนเป็นธีมขาว'}
      title={isLight ? 'ธีมขาว' : 'ธีมดำ'}
      onClick={toggleTheme}
      suppressHydrationWarning
      className={`inline-flex h-9 w-[68px] shrink-0 items-center rounded-full border p-1 transition-colors duration-200 ease-out hover:border-orange-500/60 active:scale-95 ${
        isLight
          ? 'border-slate-300 bg-white'
          : 'border-neutral-800 bg-neutral-900'
      }`}
    >
      <span
        suppressHydrationWarning
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs text-black shadow-lg transition-transform duration-200 ease-out ${
          isLight ? 'translate-x-7' : 'translate-x-0'
        }`}
      >
        {isLight ? '☀️' : '🌙'}
      </span>
    </button>
  )
}
