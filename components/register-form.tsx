'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS_TEXT } from '@/lib/password-policy'
import { formatThaiPhoneInput, THAI_PHONE_INPUT_PATTERN, THAI_PHONE_REQUIREMENTS_TEXT } from '@/lib/phone'
import { NON_STUDENT_LABEL } from '@/lib/roles'
import PasswordRequirements from '@/components/password-requirements'

interface RegisterFormProps {
  signUpAction: (formData: FormData) => Promise<never>
  message?: string
}

function SignUpButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-orange-500 rounded-md px-4 py-2 text-black mb-3 hover:bg-orange-600 transition-colors font-bold tracking-wide cursor-pointer shadow-lg shadow-orange-500/10 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? 'กำลังสมัครสมาชิก...' : 'Sign Up'}
    </button>
  )
}

function StudentMailIcon({ active }: { active: boolean }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        active
          ? 'border-orange-500/40 bg-orange-500 text-black'
          : 'border-neutral-800 bg-neutral-900 text-orange-400'
      }`}
      aria-hidden="true"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 10.5 12 6l8 4.5" />
        <path d="M6 11.5v6h12v-6" />
        <path d="M9 18v-4h6v4" />
        <path d="M3 20h18" />
      </svg>
    </span>
  )
}

function PersonalMailIcon({ active }: { active: boolean }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        active
          ? 'border-orange-500/40 bg-orange-500 text-black'
          : 'border-neutral-800 bg-neutral-900 text-orange-400'
      }`}
      aria-hidden="true"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="m4 6 8 7 8-7" />
        <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      </svg>
    </span>
  )
}

const getStudentUsernamePreview = (email: string) => {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.endsWith('@email.kmutnb.ac.th')) return ''

  return normalizedEmail.split('@')[0].replace(/^s(?=\d)/, '')
}

export default function RegisterForm({ signUpAction, message }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isOpeningLogin, setIsOpeningLogin] = useState(false)
  const [signupType, setSignupType] = useState<'student' | 'normal'>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const studentUsername = signupType === 'student' ? getStudentUsernamePreview(email) : ''
  const isStudentSignup = signupType === 'student'

  return (
    <div className="flex-1 flex flex-col w-full px-4 sm:max-w-xl justify-center gap-2 mt-8 sm:mt-12 mx-auto text-white">
      <form action={signUpAction} className="animate-in flex-1 flex flex-col w-full justify-center gap-1">
        
        <h2 className="text-2xl font-black text-center mb-6 text-orange-500 tracking-wide">
          CREATE ACCOUNT
        </h2>

        <div className="mb-5 grid auto-rows-fr gap-3 sm:grid-cols-2" role="radiogroup" aria-label="เลือกประเภทบัญชี">
          <label
            className={`flex min-h-[96px] cursor-pointer rounded-lg border p-4 transition-all ${
              isStudentSignup
                ? 'border-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/10'
                : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
            }`}
          >
            <input
              className="sr-only"
              type="radio"
              name="signupType"
              value="student"
              checked={isStudentSignup}
              onChange={() => setSignupType('student')}
            />
            <span className="flex h-full w-full items-center gap-3">
              <StudentMailIcon active={isStudentSignup} />
              <span className="flex min-h-12 flex-1 flex-col justify-center">
                <span className="block text-sm font-black leading-5 text-orange-400">ใช้เมลมหาลัย</span>
                <span className="mt-1 block min-h-8 text-xs font-medium leading-4 text-neutral-400">สำหรับนักศึกษาและบุคลากร</span>
              </span>
            </span>
          </label>

          <label
            className={`flex min-h-[96px] cursor-pointer rounded-lg border p-4 transition-all ${
              !isStudentSignup
                ? 'border-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/10'
                : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
            }`}
          >
            <input
              className="sr-only"
              type="radio"
              name="signupType"
              value="normal"
              checked={!isStudentSignup}
              onChange={() => setSignupType('normal')}
            />
            <span className="flex h-full w-full items-center gap-3">
              <PersonalMailIcon active={!isStudentSignup} />
              <span className="flex min-h-12 flex-1 flex-col justify-center">
                <span className="block text-sm font-black leading-5 text-orange-400">ใช้เมลปกติ</span>
                <span className="mt-1 block min-h-8 text-xs font-medium leading-4 text-neutral-400">สมัครเป็นบัญชีทั่วไป</span>
              </span>
            </span>
          </label>
        </div>

        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="username">
          {isStudentSignup ? 'Student ID (รหัสนักศึกษา)' : 'Username'}
        </label>
        {isStudentSignup ? (
          <input
            className="mb-4 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-white placeholder:text-neutral-600 transition-all focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            name="username"
            type="text"
            placeholder="กรอกอีเมลมหาลัยเพื่อสร้างรหัสนักศึกษา"
            value={studentUsername}
            readOnly
          />
        ) : (
          <input
            className="mb-4 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2 text-white placeholder:text-neutral-600 transition-all focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            name="username"
            type="text"
            placeholder="username"
            required
          />
        )}

        {!isStudentSignup && (
          <>
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="studentIdPreview">
              Student ID (รหัสนักศึกษา)
            </label>
            <input
              id="studentIdPreview"
              className="mb-4 cursor-not-allowed rounded-md border border-white/20 bg-white/5 px-4 py-2 text-white/70 placeholder:text-white/70"
              type="text"
              value={NON_STUDENT_LABEL}
              readOnly
            />
          </>
        )}

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

        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="phone">
          Phone Number (เบอร์โทรศัพท์)
        </label>
        <input
          className="rounded-md px-4 py-2 bg-neutral-900 border border-neutral-800 mb-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="0812345678"
          onChange={(event) => {
            event.currentTarget.value = formatThaiPhoneInput(event.currentTarget.value)
          }}
          pattern={THAI_PHONE_INPUT_PATTERN}
          title={THAI_PHONE_REQUIREMENTS_TEXT}
          required
        />

        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-neutral-900 border border-neutral-800 mb-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
          name="email"
          type="email"
          placeholder={isStudentSignup ? 's6612345678910@email.kmutnb.ac.th' : 'you@example.com'}
          pattern={isStudentSignup ? '^[sS]?[0-9A-Za-z._%+-]+@email\\.kmutnb\\.ac\\.th$' : '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'}
          title={isStudentSignup ? 'กรุณาใช้อีเมลมหาลัย @email.kmutnb.ac.th' : 'กรุณากรอกรูปแบบอีเมลให้ถูกต้อง เช่น name@example.com'}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {isStudentSignup && (
          <p className="-mt-2 mb-4 text-xs font-medium text-neutral-500">
            รหัสนักศึกษาจะถูกตั้งจากเลขหน้าอีเมลโดยอัตโนมัติ เช่น s6614012620383 จะเป็น 6614012620383
          </p>
        )}

        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="password">
          Password
        </label>
        <div className="relative mb-4">
          <input
            className="w-full rounded-md pl-4 pr-14 py-2 bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
            type={showPassword ? "text" : "password"}
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="ใส่รหัสผ่านของคุณ"
            minLength={8}
            pattern={PASSWORD_PATTERN}
            title={PASSWORD_REQUIREMENTS_TEXT}
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
        <PasswordRequirements password={password} className="-mt-2 mb-4" />

        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1" htmlFor="confirmPassword">
          Confirm Password
        </label>
        <div className="relative mb-6">
          <input
            className="w-full rounded-md pl-4 pr-14 py-2 bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all"
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="••••••••"
            minLength={8}
            pattern={PASSWORD_PATTERN}
            title={PASSWORD_REQUIREMENTS_TEXT}
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

        <SignUpButton />

        <Link
          href="/login"
          onClick={() => setIsOpeningLogin(true)}
          className="border border-neutral-800 rounded-md px-4 py-2 text-neutral-400 mb-2 text-center hover:bg-neutral-900 hover:text-orange-500 hover:border-orange-500 transition-all font-medium"
        >
          {isOpeningLogin ? 'กำลังเปิดหน้า Login...' : 'Sign In'}
        </Link>

        {message && (
          <p className="mt-4 p-4 bg-red-950/20 border border-red-900/40 text-center text-red-400 rounded-md text-sm font-medium">
            ⚠️ {message}
          </p>
        )}
      </form>
    </div>
  )
}
