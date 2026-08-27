'use client'

import React, { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS_TEXT, validatePasswordPolicy } from '@/lib/password-policy'
import PasswordRequirements from '@/components/password-requirements'

export function ResetPasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [newPasswordValue, setNewPasswordValue] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const formTarget = e.currentTarget
    const formData = new FormData(formTarget)
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    // 1. ตรวจสอบว่ารหัสผ่านใหม่ตรงกันไหม
    if (newPassword !== confirmPassword) {
      setErrorMessage('รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน')
      setIsPending(false)
      return
    }

    const passwordPolicyError = validatePasswordPolicy(newPassword)
    if (passwordPolicyError) {
      setErrorMessage(passwordPolicyError)
      setIsPending(false)
      return
    }

    try {
      // 3. 💡 อัปเดตรหัสผ่านใหม่ลงระบบได้เลยโดยตรง (ไม่ต้องใช้รหัสผ่านเดิม)
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) throw error

      setSuccessMessage('ตั้งรหัสผ่านใหม่ของคุณสำเร็จเรียบร้อยแล้ว! 🔒')
      setNewPasswordValue('')
      formTarget.reset()

      // 4. สั่ง Sign Out ออกจากเซสชันกู้คืน เพื่อบังคับให้ล็อกอินใหม่อีกครั้ง
      await supabase.auth.signOut()
      
      // หน่วงเวลา 2 วินาทีเพื่อให้ผู้ใช้ดูสถานะสำเร็จ ก่อนจะพาวิ่งกลับไปหน้า Login
      setTimeout(() => {
        window.location.href = '/login?message=เปลี่ยนรหัสผ่านเรียบร้อย! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ของคุณ'
      }, 2000)

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่'
      setErrorMessage(message)
      setIsPending(false)
    }
  }

  return (
    <div className="w-full px-4 sm:max-w-md text-white animate-in">
      {/* ดีไซน์กรอบการ์ดรมดำ ล้อมรอบด้วยเส้นขอบบางหรูหรา */}
      <div className=" border border-neutral-900 rounded-2xl p-6 sm:p-8 shadow-2xl w-full">
        
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
          
          <h2 className="text-xl font-black text-center text-orange-500 tracking-wide uppercase">
            Create New Password
          </h2>
          <p className="text-xs text-neutral-400 text-center mb-2">
            กำหนดรหัสผ่านใหม่สำหรับบัญชี FOOD ORDER ของคุณ
          </p>

          {/* ช่องกรอกรหัสผ่านใหม่ */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider" htmlFor="newPassword">
              New Password
            </label>
            <input
              className="rounded-md px-4 py-2.5 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm transition-all placeholder:text-neutral-700"
              name="newPassword"
              type="password"
              value={newPasswordValue}
              onChange={(event) => setNewPasswordValue(event.target.value)}
              placeholder="อย่างน้อย 8 ตัว มี A-Z, 0-9 และ @"
              minLength={8}
              pattern={PASSWORD_PATTERN}
              title={PASSWORD_REQUIREMENTS_TEXT}
              required
            />
            <PasswordRequirements password={newPasswordValue} className="mt-2" />
          </div>

          {/* ช่องยืนยันรหัสผ่านใหม่ */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider" htmlFor="confirmPassword">
              Confirm New Password
            </label>
            <input
              className="rounded-md px-4 py-2.5 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm transition-all placeholder:text-neutral-700"
              name="confirmPassword"
              type="password"
              placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
              minLength={8}
              pattern={PASSWORD_PATTERN}
              title={PASSWORD_REQUIREMENTS_TEXT}
              required
            />
          </div>

          {/* ปุ่มบันทึกการรีเซ็ต */}
          <button 
            type="submit" 
            disabled={isPending}
            className="bg-orange-500 rounded-md px-6 py-2.5 text-black hover:bg-orange-600  disabled:text-neutral-600 transition-colors font-bold text-sm cursor-pointer shadow-lg shadow-orange-500/10 mt-2 w-full"
          >
            {isPending ? 'Saving...' : 'Confirm Reset Password'}
          </button>

          {/* กล่องข้อความแจ้งเตือนสีเขียวเมื่อทำงานสำเร็จ */}
          {successMessage && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-900/40 text-center text-emerald-400 rounded-md text-xs font-medium mt-2">
              ✅ {successMessage}
            </div>
          )}

          {/* กล่องข้อความแจ้งเตือนสีแดงเมื่อเกิด Error */}
          {errorMessage && (
            <div className="p-3 bg-red-950/20 border border-red-900/40 text-center text-red-400 rounded-md text-xs font-medium mt-2">
              ⚠️ {errorMessage}
            </div>
          )}

        </form>
      </div>
    </div>
  )
}
