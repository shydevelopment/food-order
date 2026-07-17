'use client'

import React, { useState } from 'react'
import Link from 'next/link'

interface ForgotPasswordFormProps {
  sendAction: (formData: FormData) => Promise<{ success: boolean; message?: string }>
}

export function ForgotPasswordForm({ sendAction }: ForgotPasswordFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [stateMessage, setStateMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setStateMessage(null)

    const formData = new FormData(e.currentTarget)
    try {
      const res = await sendAction(formData)
      if (res.success) {
        window.location.href = '/login?message=ส่งลิงก์กู้คืนรหัสผ่านไปยังอีเมลของคุณแล้ว! กรุณาตรวจสอบกล่องข้อความ'
      } else {
        // แสดงข้อความที่ส่งกลับมาจาก Supabase โดยตรง (เช่น Email not found หรือ Rate limit)
        setStateMessage(res.message || 'เกิดข้อผิดพลาดในการส่งคำขอ')
      }
    } catch (err) {
      // 💡 พิมพ์ข้อความ Error จริงลง Console เพื่อให้ตรวจสอบง่ายขึ้น
      console.error('Client Submit Error:', err)
      setStateMessage('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col w-full px-4 sm:max-w-md justify-center gap-2 mt-12 mx-auto text-white">
      <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-6 sm:p-8 shadow-2xl w-full">
        
        <form onSubmit={handleSubmit} className="animate-in flex-1 flex flex-col w-full justify-center gap-1">
          <h2 className="text-2xl font-black text-center mb-1 text-orange-500 tracking-wide uppercase">
            Reset Password
          </h2>
          <p className="text-xs text-neutral-400 text-center mb-6">
            กรอกอีเมลของคุณเพื่อรับลิงก์กู้คืนรหัสผ่าน
          </p>

          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="email">
            Email Address
          </label>
          <input
            className="rounded-md px-4 py-2.5 bg-neutral-900 border border-neutral-800 mb-6 focus:outline-none focus:border-orange-500 text-white text-sm"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />

          <button
            type="submit"
            disabled={isPending}
            className="bg-orange-500 rounded-md px-4 py-2.5 text-black mb-4 hover:bg-orange-600 disabled:bg-neutral-800 transition-colors font-bold text-sm cursor-pointer shadow-lg w-full"
          >
            {isPending ? 'Sending Link...' : 'Send Reset Link'}
          </button>

          <div className="text-center text-sm text-neutral-400">
            จำรหัสผ่านได้แล้ว?{' '}
            <Link href="/login" className="text-orange-500 hover:text-orange-400 font-bold transition-colors underline ml-1">
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>

          {stateMessage && (
            <p className="mt-4 p-4 bg-red-950/20 border border-red-900/40 text-center text-red-400 rounded-md text-sm font-medium">
              ⚠️ {stateMessage}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}