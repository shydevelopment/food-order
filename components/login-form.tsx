'use client'

import React, { useState } from 'react'
import Link from 'next/link'

interface LoginFormProps {
  signInAction: (formData: FormData) => Promise<never>
  message?: string
}

export default function LoginForm({ signInAction, message }: LoginFormProps) {
  // 💡 สร้าง State สำหรับควบคุมการเปิด-ปิดตาของรหัสผ่าน
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mt-12 mx-auto text-white">
      <form action={signInAction} className="animate-in flex-1 flex flex-col w-full justify-center gap-1">
        
        <h2 className="text-2xl font-black text-center mb-6 text-orange-500 tracking-wide">
          Log In
        </h2>

        {/* ช่องกรอก Email */}
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-neutral-900 border border-neutral-800 mb-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
          name="email"
          type="email"
          placeholder="you@example.com"
          pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
          title="กรุณากรอกรูปแบบอีเมลให้ถูกต้อง เช่น name@example.com"
          required
        />

        {/* ช่องกรอก Password พร้อมปุ่มเปิด-ปิดตาด้านใน */}
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="password">
          Password
        </label>
        <div className="relative mb-6">
          <input
            className="w-full rounded-md pl-4 pr-14 py-2 bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
            // 💡 สลับประเภทอินพุตระหว่าง text และ password ตามสถานะของปุ่มตา
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="••••••••"
            required
          />
          {/* ปุ่มข้อความ SHOW/HIDE จัดตำแหน่งให้อยู่ฝั่งขวาสุดภายในช่องพอดี */}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-widest text-neutral-500 hover:text-orange-500 transition-colors focus:outline-none cursor-pointer select-none"
          >
            {showPassword ? "HIDE" : "SHOW"}
          </button>
        </div>
        
        {/* ปุ่มหลัก Sign In */}
        <button
          type="submit"
          className="bg-orange-500 rounded-md px-4 py-2 text-black mb-3 hover:bg-orange-600 transition-colors font-bold tracking-wide cursor-pointer shadow-lg shadow-orange-500/10"
        >
          Sign In
        </button>
        
        {/* ปุ่มรอง Sign Up */}
        <Link
          href="/register"
          className="border border-neutral-800 rounded-md px-4 py-2 text-neutral-400 mb-2 text-center hover:bg-neutral-900 hover:text-orange-500 hover:border-orange-500 transition-all font-medium"
        >
          Sign Up
        </Link>

        {/* แสดงข้อความ Error */}
        {message && (
          <p className="mt-4 p-4 bg-red-950/20 border border-red-900/40 text-center text-red-400 rounded-md text-sm font-medium">
            ⚠️ {message}
          </p>
        )}
      </form>
    </div>
  )
}