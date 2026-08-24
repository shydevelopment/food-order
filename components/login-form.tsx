'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useFormStatus } from 'react-dom'

interface LoginFormProps {
  signInAction: (formData: FormData) => Promise<never>
  message?: string
  messageType?: 'success' | 'error'
  turnstileSiteKey?: string
}

function SignInButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-orange-500 rounded-md px-4 py-2.5 text-black mb-3 hover:bg-orange-600 transition-colors font-bold tracking-wide cursor-pointer shadow-lg shadow-orange-500/10 text-sm disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? 'กำลังเข้าสู่ระบบ...' : 'Sign In'}
    </button>
  )
}

const REMEMBERED_EMAIL_KEY = 'food-order-login-email'

export default function LoginForm({
  signInAction,
  message,
  messageType = 'error',
  turnstileSiteKey,
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [isOpeningRegister, setIsOpeningRegister] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY)
      if (rememberedEmail) {
        setEmail(rememberedEmail)
        setRemember(true)
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  function handleSubmit() {
    const trimmedEmail = email.trim()

    if (remember && trimmedEmail) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmedEmail)
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
    }
  }

  return (
    <div className="flex flex-col w-full px-4 sm:max-w-md justify-center gap-2 mt-12 mx-auto text-white">
      {turnstileSiteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      )}
      
      <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-6 sm:p-8 shadow-2xl w-full">
        
        <form
          action={signInAction}
          onSubmit={handleSubmit}
          className="animate-in flex-1 flex flex-col w-full justify-center gap-1"
        >
          
          <h2 className="text-2xl font-black text-center mb-6 text-orange-500 tracking-wide uppercase">
            Log In
          </h2>

          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="email">
            Email
          </label>
          <input
            className="rounded-md px-4 py-2.5 bg-neutral-900 border border-neutral-800 mb-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all text-sm"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
            title="กรุณากรอกรูปแบบอีเมลให้ถูกต้อง"
            required
          />

          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider" htmlFor="password">
              Password
            </label>

            <Link 
              href="/forgot-password" 
              className="text-[11px] text-neutral-500 hover:text-orange-400 transition-colors font-medium"
            >
              Forgot Password?
            </Link>
          </div>
          
          <div className="relative mb-6">
            <input
              className="w-full rounded-md pl-4 pr-14 py-2.5 bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-700 transition-all text-sm"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-widest text-neutral-500 hover:text-orange-500 transition-colors focus:outline-none cursor-pointer select-none"
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>

          {turnstileSiteKey && (
            <div className="mb-4 flex min-h-[65px] w-full items-center justify-center overflow-hidden rounded-md border border-neutral-800 bg-neutral-900">
              <div
                className="cf-turnstile w-full"
                data-sitekey={turnstileSiteKey}
                data-theme="dark"
                data-size="flexible"
                data-action="login"
              />
            </div>
          )}

          <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-400 transition-colors hover:text-orange-400">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-orange-500 accent-orange-500"
            />
            <span>Remember me</span>
          </label>
          
          <SignInButton />
          
          <Link
            href="/register"
            onClick={() => setIsOpeningRegister(true)}
            className="border border-neutral-800 rounded-md px-4 py-2.5 text-neutral-400 text-center hover:bg-neutral-900 hover:text-orange-500 hover:border-orange-500 transition-all font-bold text-sm"
          >
            {isOpeningRegister ? 'กำลังเปิดหน้า Register...' : 'Sign Up'}
          </Link>

          {message && (
            <p
              className={`mt-4 rounded-md border p-4 text-center text-sm font-medium ${
                messageType === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-900/40 bg-red-950/20 text-red-400'
              }`}
            >
              {messageType === 'success' ? '✅' : '⚠️'} {message}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
