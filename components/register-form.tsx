'use client'

import React, { useState } from 'react'
import Link from 'next/link'

interface RegisterFormProps {
  signUpAction: (formData: FormData) => Promise<never>
  message?: string
}

export default function RegisterForm({ signUpAction, message }: RegisterFormProps) {
  // 💡 ปรับเหลือ State เดียวสำหรับควบคุมทั้ง 2 ช่องพร้อมกัน
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mt-12 mx-auto text-white">
      <form action={signUpAction} className="animate-in flex-1 flex flex-col w-full justify-center gap-1">
        
        <h2 className="text-2xl font-black text-center mb-6 text-orange-500 tracking-wide">
          CREATE ACCOUNT
        </h2>

        {/* ช่องกรอก Username */}
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="username">
          Username
        </label>
        <input
          className="rounded-md px-4 py-2 bg-neutral-900 border border-neutral-800 mb-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
          name="username"
          type="text"
          placeholder="username"
          required
        />

        {/* ช่องกรอก Display Name */}
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="displayName">
          Display Name
        </label>
        <input
          className="rounded-md px-4 py-2 bg-neutral-900 border border-neutral-800 mb-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
          name="displayName"
          type="text"
          placeholder="Display Name"
          required
        />

        {/* ช่องกรอกเบอร์โทรศัพท์ */}
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="phone">
          Phone Number (เบอร์โทรศัพท์)
        </label>
        <input
          className="rounded-md px-4 py-2 bg-neutral-900 border border-neutral-800 mb-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
          name="phone"
          type="tel"
          placeholder="0812345678"
          pattern="^0[0-9]{8,9}$"
          title="กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (ขึ้นต้นด้วย 0 และมีความยาว 9-10 หลัก)"
          required
        />

        {/* ช่องกรอก Email */}
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-neutral-900 border border-neutral-800 mb-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
          name="email"
          type="email"
          placeholder="bababooey@example.com"
          pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
          title="กรุณากรอกรูปแบบอีเมลให้ถูกต้อง เช่น name@example.com"
          required
        />

        {/* ช่องกรอก Password */}
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="password">
          Password
        </label>
        <div className="relative mb-4">
          <input
            className="w-full rounded-md pl-4 pr-14 py-2 bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
            type={showPassword ? "text" : "password"} // 💡 ใช้ตัวแปร showPassword
            name="password"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)} // 💡 กดสลับแล้วจะเปลี่ยนสถานะพร้อมกันทั้งคู่
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-widest text-neutral-500 hover:text-orange-500 transition-colors focus:outline-none cursor-pointer select-none"
          >
            {showPassword ? "HIDE" : "SHOW"}
          </button>
        </div>

        {/* ช่องกรอก Confirm Password */}
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="confirmPassword">
          Confirm Password
        </label>
        <div className="relative mb-6">
          <input
            className="w-full rounded-md pl-4 pr-14 py-2 bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
            type={showPassword ? "text" : "password"} // 💡 เปลี่ยนมาผูกกับตัวแปร showPassword ตัวเดียวกัน
            name="confirmPassword"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)} // 💡 ผูกฟังก์ชันเข้าด้วยกัน กดตรงนี้อีกช่องก็เปลี่ยน
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-widest text-neutral-500 hover:text-orange-500 transition-colors focus:outline-none cursor-pointer select-none"
          >
            {showPassword ? "HIDE" : "SHOW"}
          </button>
        </div>

        {/* ปุ่มหลัก Sign Up */}
        <button
          type="submit"
          className="bg-orange-500 rounded-md px-4 py-2 text-black mb-3 hover:bg-orange-600 transition-colors font-bold tracking-wide cursor-pointer shadow-lg shadow-orange-500/10"
        >
          Sign Up
        </button>

        {/* ปุ่มรอง Sign In */}
        <Link
          href="/login"
          className="border border-neutral-800 rounded-md px-4 py-2 text-neutral-400 mb-2 text-center hover:bg-neutral-900 hover:text-orange-500 hover:border-orange-500 transition-all font-medium"
        >
          Sign In
        </Link>

        {/* แสดงข้อความแจ้งเตือน Error */}
        {message && (
          <p className="mt-4 p-4 bg-red-950/20 border border-red-900/40 text-center text-red-400 rounded-md text-sm font-medium">
            ⚠️ {message}
          </p>
        )}
      </form>
    </div>
  )
}