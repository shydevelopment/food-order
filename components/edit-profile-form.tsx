'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import {
  normalizeNotificationPreferences,
  systemNotificationOptions,
  type CustomNotificationSound,
  type NotificationPreferences,
  type SystemNotificationId,
} from '@/lib/notification-preferences'
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS_TEXT, validatePasswordPolicy } from '@/lib/password-policy'
import {
  formatThaiPhoneInput,
  THAI_PHONE_INPUT_PATTERN,
  THAI_PHONE_REQUIREMENTS_TEXT,
} from '@/lib/phone'
import { getProfileStudentIdDisplay, NON_STUDENT_LABEL } from '@/lib/roles'
import PasswordRequirements from '@/components/password-requirements'

interface EditableProfile {
  username: string | null
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role?: string | null
  student_id?: string | null
  notification_preferences?: unknown
}

interface EditProfileFormProps {
  profile: EditableProfile | null
  email: string | undefined
  isEmailConfirmed?: boolean
  isStudentAccount?: boolean
  studentUsername?: string | null
  updateAction: (formData: FormData) => Promise<{ success: boolean; message?: string }>
  updateNotificationAction?: (formData: FormData) => Promise<{ success: boolean; message?: string }>
  resendAction?: () => Promise<{ success: boolean; message?: string }>
}

export default function EditProfileForm({
  profile,
  email,
  isEmailConfirmed = false,
  isStudentAccount = false,
  studentUsername,
  updateAction,
  updateNotificationAction,
  resendAction,
}: EditProfileFormProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'avatar' | 'password' | 'notifications' | null>('profile')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const initialNotificationPreferences = normalizeNotificationPreferences(profile?.notification_preferences)
  const [selectedSystemNotifications, setSelectedSystemNotifications] = useState<SystemNotificationId[]>(
    initialNotificationPreferences.system
  )
  const [customNotifications, setCustomNotifications] = useState<CustomNotificationSound[]>(initialNotificationPreferences.custom)
  const lockedUsername = studentUsername || profile?.username || ''
  const lockedDisplayName = profile?.full_name || ''
  const studentIdDisplay = getProfileStudentIdDisplay(profile || {}, email)
  const hasStudentId = studentIdDisplay !== NON_STUDENT_LABEL
  const lockedInputClass = 'cursor-not-allowed border-white/20 bg-white/10 text-white/70'
  const editableInputClass = ' border-neutral-800 focus:outline-none focus:border-orange-500 text-white'
  const notificationSoundsBucket = 'notification-sounds'

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const toggleTab = (tab: 'profile' | 'avatar' | 'password' | 'notifications') => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setActiveTab((prev) => (prev === tab ? null : tab))
  }

  const setDesktopTab = (tab: 'profile' | 'avatar' | 'password' | 'notifications') => {
    setActiveTab(tab)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  // ⚡ ฟังก์ชันสำหรับกดส่งอีเมลยืนยันอีกครั้ง
  const handleResendEmail = async () => {
    if (!resendAction) return
    setIsPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await resendAction()
      if (res.success) {
        setSuccessMessage(res.message || 'ส่งลิงก์ยืนยันตัวตนไปยังอีเมลของคุณเรียบร้อยแล้ว! ✉️')
      } else {
        setErrorMessage(res.message || 'เกิดข้อผิดพลาดในการส่งอีเมล')
      }
    } catch {
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์')
    } finally {
      setIsPending(false)
    }
  }

  // 1. Function Handle Avatar Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User session not found. Please log in again.')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      setSuccessMessage('Profile picture updated successfully! 🎉')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while uploading the image.'
      setErrorMessage(message)
    } finally {
      setIsPending(false)
    }
  }

  // 2. Function Handle Saving Profile
  const handleSubmitProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const formData = new FormData(e.currentTarget)
    try {
      const res = await updateAction(formData)
      if (res.success) {
        window.location.assign('/?message=Profile updated successfully!')
      } else {
        setErrorMessage(res.message || 'An error occurred while updating information.')
      }
    } catch {
      setErrorMessage('An error occurred while connecting to the server.')
    } finally {
      setIsPending(false)
    }
  }

  // 3. Function Handle Changing Password
  const handleSubmitPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const formTarget = e.currentTarget 
    const formData = new FormData(formTarget)
    
    const oldPassword = formData.get('oldPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (newPassword !== confirmPassword) {
      setErrorMessage('The new password and confirmation password do not match.')
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
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: email || '',
        password: oldPassword,
      })

      if (verifyError) {
        setErrorMessage('Incorrect current password. Password update failed.')
        setIsPending(false)
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
      })
      
      if (updateError) throw updateError

      formTarget.reset() 

      await supabase.auth.signOut()
      setNewPasswordValue('')
      window.location.assign('/login?message=Password changed successfully! Please log in again using your new password.')

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while updating the password.'
      setErrorMessage(message)
      setIsPending(false)
    }
  }

  const toggleSystemNotification = (id: SystemNotificationId) => {
    setSelectedSystemNotifications((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ))
  }

  const getAudioDuration = (file: File) => new Promise<number>((resolve, reject) => {
    const audio = document.createElement('audio')
    const objectUrl = URL.createObjectURL(file)

    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(audio.duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('ไม่สามารถอ่านความยาวไฟล์เสียงได้'))
    }
    audio.src = objectUrl
  })

  const sanitizeAudioFileName = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3'
    const baseName = fileName
      .replace(/\.[^/.]+$/, '')
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'notification'

    return `${baseName}.${extension}`
  }

  const formatSoundDuration = (duration: number) => {
    return `${duration.toFixed(1)}s`
  }

  const handleCustomNotificationAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setIsPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      if (!file.type.startsWith('audio/')) {
        throw new Error('กรุณาเลือกไฟล์เสียงเท่านั้น')
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new Error('ไฟล์เสียงต้องมีขนาดไม่เกิน 2MB')
      }

      const duration = await getAudioDuration(file)

      if (duration < 3 || duration > 5) {
        throw new Error('ไฟล์เสียงแจ้งเตือนต้องมีความยาว 3-5 วินาที')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')

      const filePath = `${user.id}/${crypto.randomUUID()}-${sanitizeAudioFileName(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from(notificationSoundsBucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(notificationSoundsBucket)
        .getPublicUrl(filePath)

      const { data: soundRecord, error: soundInsertError } = await supabase
        .from('notification_sounds')
        .insert({
          owner_user_id: user.id,
          notification_type: 'custom',
          name: file.name.slice(0, 80),
          sound_url: publicUrl,
          storage_path: filePath,
          duration_seconds: Number(duration.toFixed(2)),
          is_system: false,
        })
        .select('id')
        .single()

      if (soundInsertError) throw soundInsertError

      const nextSound: CustomNotificationSound = {
        id: String(soundRecord.id),
        sound_id: String(soundRecord.id),
        name: file.name.slice(0, 80),
        url: publicUrl,
        duration: Number(duration.toFixed(2)),
      }

      setCustomNotifications((current) => [...current, nextSound].slice(0, 10))
      setSuccessMessage('เพิ่มไฟล์เสียงแจ้งเตือนเรียบร้อยแล้ว')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถเพิ่มไฟล์เสียงแจ้งเตือนได้'
      setErrorMessage(message)
    } finally {
      setIsPending(false)
    }
  }

  const removeCustomNotification = (notification: CustomNotificationSound) => {
    setCustomNotifications((current) => current.filter((item) => item.id !== notification.id))

    try {
      if (notification.sound_id) {
        supabase
          .from('notification_sounds')
          .delete()
          .eq('id', notification.sound_id)
      }

      const marker = `/${notificationSoundsBucket}/`
      const objectPath = notification.url.split(marker)[1]
      if (objectPath) {
        supabase.storage.from(notificationSoundsBucket).remove([decodeURIComponent(objectPath)])
      }
    } catch {
      return
    }
  }

  const handleSubmitNotifications = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!updateNotificationAction) {
      setErrorMessage('ยังไม่ได้เชื่อมระบบบันทึกแจ้งเตือน')
      return
    }

    setIsPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const notificationPreferences: NotificationPreferences = {
      system: selectedSystemNotifications,
      custom: customNotifications,
    }
    const formData = new FormData()
    formData.set('notificationPreferences', JSON.stringify(notificationPreferences))

    try {
      const res = await updateNotificationAction(formData)

      if (res.success) {
        setSuccessMessage(res.message || 'บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว')
      } else {
        setErrorMessage(res.message || 'ไม่สามารถบันทึกการตั้งค่าแจ้งเตือนได้')
      }
    } catch {
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto text-white p-2">
      
      {/* Header Profile */}
      <div className="mb-6 p-4  border border-neutral-800/80 rounded-2xl flex items-center gap-4 shadow-lg">
        {avatarUrl ? (
          <img src={avatarUrl} alt="รูปโปรไฟล์" className="w-12 h-12 sm:w-14 sm:h-12 rounded-xl object-cover border border-orange-500/40 shrink-0" />
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-12 rounded-xl bg-orange-500 flex items-center justify-center font-black text-black text-lg shrink-0">
            {(profile?.full_name || profile?.username || email)?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="overflow-hidden">
          <h4 className="font-bold text-base sm:text-lg text-neutral-100 truncate">{profile?.full_name || profile?.username || 'User'}</h4>
          <p className="text-xs text-orange-400 font-medium truncate">@{profile?.username || 'username'} • {email}</p>
        </div>
      </div>

      {/* 📱 1. LAYOUT สำหรับจอมือถือ */}
      <div className="flex flex-col gap-3 md:hidden">
        
        {/* ACCORDION 1: PROFILE */}
        <div className=" border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => toggleTab('profile')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm   transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="text-base">👤</span>
              <span className={activeTab === 'profile' ? 'text-orange-500' : 'text-neutral-300'}>แก้ไขโปรไฟล์</span>
            </span>
            <span className={`text-xs text-neutral-400 transition-transform duration-300 ${activeTab === 'profile' ? 'rotate-180 text-orange-500' : ''}`}>▼</span>
          </button>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${activeTab === 'profile' ? 'grid-rows-[1fr] opacity-100 border-t border-neutral-800/60' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden ">
              <form onSubmit={handleSubmitProfile} className="p-4 flex flex-col gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">{isStudentAccount ? 'Student ID / รหัสนักศึกษา' : 'Username'}</label>
                    <input className={`w-full rounded-xl px-4 py-2.5 border text-sm ${isStudentAccount ? lockedInputClass : editableInputClass}`} name="username" type="text" value={isStudentAccount ? lockedUsername : undefined} defaultValue={isStudentAccount ? undefined : profile?.username || ''} readOnly={isStudentAccount} required />
                    {hasStudentId && (
                      <p className="mt-1 text-[11px] font-medium text-white/60">ระบบใช้รหัสนักศึกษาจากอีเมลมหาลัย</p>
                    )}
                  </div>
                  {!isStudentAccount && (
                    <div>
                      <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">รหัสนักศึกษา</label>
                      <input className={`${lockedInputClass} w-full rounded-xl px-4 py-2.5 border text-sm`} type="text" value={studentIdDisplay} readOnly />
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">ชื่อที่แสดง</label>
                    <input className={`w-full rounded-xl px-4 py-2.5 border text-sm ${isStudentAccount ? lockedInputClass : editableInputClass}`} name="displayName" type="text" value={isStudentAccount ? lockedDisplayName : undefined} defaultValue={isStudentAccount ? undefined : profile?.full_name || ''} readOnly={isStudentAccount} required />
                    {isStudentAccount && (
                      <p className="mt-1 text-[11px] font-medium text-white/60">บัญชีนักศึกษาไม่สามารถแก้ชื่อผู้ใช้และชื่อที่แสดงได้</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">เบอร์โทรศัพท์</label>
                    <input className="w-full rounded-xl px-4 py-2.5  border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="phone" type="tel" inputMode="tel" defaultValue={formatThaiPhoneInput(profile?.phone || '')} onChange={(event) => { event.currentTarget.value = formatThaiPhoneInput(event.currentTarget.value) }} pattern={THAI_PHONE_INPUT_PATTERN} title={THAI_PHONE_REQUIREMENTS_TEXT} required />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">อีเมล</label>
                    <input className="w-full rounded-xl px-4 py-2.5  border border-neutral-900/40 text-neutral-500 cursor-not-allowed select-none text-sm" type="email" value={email || ''} disabled />

                    {/* ⚡ แสดงสถานะและปุ่มยืนยันอีเมลบนมือถือ */}
                    <div className="mt-2">
                      {isEmailConfirmed ? (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                          ✓ Verified Email
                        </span>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-xl">
                          <span className="text-[11px] text-amber-400 font-medium">⚠️ ยังไม่ได้ยืนยันอีเมล</span>
                          <button
                            type="button"
                            onClick={handleResendEmail}
                            disabled={isPending}
                            className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            Resend Link
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={isPending} className="w-full bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl py-2.5 text-black font-bold shadow-lg text-sm transition-all mt-2 cursor-pointer ">
                  {isPending ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ACCORDION 2: AVATAR */}
        <div className=" border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => toggleTab('avatar')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm   transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="text-base">🖼️</span>
              <span className={activeTab === 'avatar' ? 'text-orange-500' : 'text-neutral-300'}>เปลี่ยนรูปโปรไฟล์</span>
            </span>
            <span className={`text-xs text-neutral-400 transition-transform duration-300 ${activeTab === 'avatar' ? 'rotate-180 text-orange-500' : ''}`}>▼</span>
          </button>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${activeTab === 'avatar' ? 'grid-rows-[1fr] opacity-100 border-t border-neutral-800/60' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden ">
              <div className="p-6 flex flex-col items-center gap-4 text-center">
                <div className="relative cursor-pointer group active:scale-95 transition-transform" onClick={() => document.getElementById('avatar-file-mobile')?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="รูปโปรไฟล์" className="w-28 h-28 rounded-2xl object-cover border-2 border-orange-500 shadow-xl" />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl  border border-neutral-800 flex items-center justify-center font-black text-orange-500 text-3xl">
                      {(profile?.full_name || profile?.username || email)?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-orange-500 text-black p-1.5 rounded-lg shadow-lg text-xs font-bold">📷</div>
                </div>
                <p className="text-xs text-neutral-400">แตะรูปหรือกดปุ่มด้านล่างเพื่ออัปโหลดรูปโปรไฟล์</p>
                <input type="file" id="avatar-file-mobile" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isPending} />
                <button type="button" disabled={isPending} onClick={() => document.getElementById('avatar-file-mobile')?.click()} className="w-full bg-orange-500 hover:bg-orange-400 text-black active:scale-95 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-lg ">
                  {isPending ? 'Uploading...' : '📁 Choose Image File'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ACCORDION 3: PASSWORD */}
        <div className=" border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => toggleTab('password')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm   transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="text-base">🔒</span>
              <span className={activeTab === 'password' ? 'text-orange-500' : 'text-neutral-300'}>เปลี่ยนรหัสผ่าน</span>
            </span>
            <span className={`text-xs text-neutral-400 transition-transform duration-300 ${activeTab === 'password' ? 'rotate-180 text-orange-500' : ''}`}>▼</span>
          </button>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${activeTab === 'password' ? 'grid-rows-[1fr] opacity-100 border-t border-neutral-800/60' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden ">
              <form onSubmit={handleSubmitPassword} className="p-4 flex flex-col gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">รหัสผ่านปัจจุบัน</label>
                    <input className="w-full rounded-xl px-4 py-2.5  border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="oldPassword" type="password" required />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">รหัสผ่านใหม่</label>
                    <input className="w-full rounded-xl px-4 py-2.5  border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="newPassword" type="password" value={newPasswordValue} onChange={(event) => setNewPasswordValue(event.target.value)} placeholder="อย่างน้อย 8 ตัว มี A-Z, 0-9 และ @" minLength={8} pattern={PASSWORD_PATTERN} title={PASSWORD_REQUIREMENTS_TEXT} required />
                    <PasswordRequirements password={newPasswordValue} className="mt-2" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">ยืนยันรหัสผ่าน</label>
                    <input className="w-full rounded-xl px-4 py-2.5  border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="confirmPassword" type="password" minLength={8} pattern={PASSWORD_PATTERN} title={PASSWORD_REQUIREMENTS_TEXT} required />
                  </div>
                </div>
                <button type="submit" disabled={isPending} className="w-full bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl py-2.5 text-black font-bold shadow-lg text-sm transition-all mt-2 cursor-pointer ">
                  {isPending ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ACCORDION 4: NOTIFICATIONS */}
        <div className=" border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => toggleTab('notifications')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm   transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="text-base">🔔</span>
              <span className={activeTab === 'notifications' ? 'text-orange-500' : 'text-neutral-300'}>การแจ้งเตือน</span>
            </span>
            <span className={`text-xs text-neutral-400 transition-transform duration-300 ${activeTab === 'notifications' ? 'rotate-180 text-orange-500' : ''}`}>▼</span>
          </button>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${activeTab === 'notifications' ? 'grid-rows-[1fr] opacity-100 border-t border-neutral-800/60' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden ">
              <form onSubmit={handleSubmitNotifications} className="p-4 flex flex-col gap-4">
                <div className="space-y-2">
                  {systemNotificationOptions.map((option) => (
                    <label key={option.id} className="flex items-start gap-3 rounded-xl border border-neutral-800  p-3">
                      <input
                        type="checkbox"
                        checked={selectedSystemNotifications.includes(option.id)}
                        onChange={() => toggleSystemNotification(option.id)}
                        className="mt-1 h-4 w-4 accent-orange-500"
                      />
                      <span>
                        <span className="block text-sm font-black text-white">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-neutral-500">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="rounded-xl border border-neutral-800  p-3">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">เสียงแจ้งเตือนที่กำหนดเอง</label>
                  <div className="mt-2">
                    <input
                      id="custom-sound-mobile"
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleCustomNotificationAudioUpload}
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('custom-sound-mobile')?.click()}
                      disabled={isPending}
                      className="w-full rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-black transition hover:bg-orange-400  disabled:text-neutral-500"
                    >
                      {isPending ? 'กำลังอัปโหลด...' : 'Add Sound File'}
                    </button>
                    <p className="mt-2 text-xs text-neutral-500">รับไฟล์เสียงความยาว 3-5 วินาที ขนาดไม่เกิน 2MB</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {customNotifications.length > 0 ? customNotifications.map((notification) => (
                      <div key={notification.id} className="rounded-xl border border-neutral-800 bg-black p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-white">{notification.name}</p>
                            <p className="text-[11px] text-neutral-500">{formatSoundDuration(notification.duration)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCustomNotification(notification)}
                            className="rounded-lg border border-red-500/30 px-2 py-1 text-[11px] font-bold text-red-400 transition hover:bg-red-500/10"
                          >
                            ลบ
                          </button>
                        </div>
                        <audio controls src={notification.url} className="h-9 w-full" />
                      </div>
                    )) : (
                      <span className="text-xs text-neutral-500">ยังไม่มีไฟล์เสียงแจ้งเตือนที่เพิ่มเอง</span>
                    )}
                  </div>
                </div>

                <button type="submit" disabled={isPending} className="w-full bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl py-2.5 text-black font-bold shadow-lg text-sm transition-all cursor-pointer ">
                  {isPending ? 'Saving...' : 'Save Notifications'}
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>

      {/* 💻 2. LAYOUT สำหรับจอคอมพิวเตอร์ DESKTOP */}
      <div className="hidden md:flex gap-6 items-start">
        
        {/* SIDEBAR MENU */}
        <div className="w-64  border border-neutral-800/80 rounded-2xl p-4 flex flex-col gap-2 shrink-0 shadow-lg">
          <button type="button" onClick={() => setDesktopTab('profile')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left font-bold text-sm transition-all cursor-pointer ${activeTab === 'profile' ? 'bg-orange-500 text-black shadow-md shadow-orange-500/10' : 'text-neutral-400 '}`}>
            <span>👤</span> User Information
          </button>
          <button type="button" onClick={() => setDesktopTab('avatar')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left font-bold text-sm transition-all cursor-pointer ${activeTab === 'avatar' ? 'bg-orange-500 text-black shadow-md shadow-orange-500/10' : 'text-neutral-400 '}`}>
            <span>🖼️</span> Avatar Settings
          </button>
          <button type="button" onClick={() => setDesktopTab('password')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left font-bold text-sm transition-all cursor-pointer ${activeTab === 'password' ? 'bg-orange-500 text-black shadow-md shadow-orange-500/10' : 'text-neutral-400 '}`}>
            <span>🔒</span> Change Password
          </button>
          <button type="button" onClick={() => setDesktopTab('notifications')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left font-bold text-sm transition-all cursor-pointer ${activeTab === 'notifications' ? 'bg-orange-500 text-black shadow-md shadow-orange-500/10' : 'text-neutral-400 '}`}>
            <span>🔔</span> Notifications
          </button>
        </div>

        {/* CONTENT CARD */}
        <div className="flex-1  border border-neutral-800/80 rounded-2xl shadow-xl overflow-hidden">
          
          {/* DESKTOP TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-neutral-800/80 ">
                <h3 className="text-lg font-black tracking-wide text-neutral-200">ข้อมูลผู้ใช้</h3>
              </div>
              <form onSubmit={handleSubmitProfile} className="p-6 flex flex-col gap-5">
                <div className="space-y-4 max-w-xl">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">{isStudentAccount ? 'Student ID' : 'Username'}</label>
                    <div className="col-span-2">
                      <input className={`w-full rounded-xl px-4 py-2 border text-sm ${isStudentAccount ? lockedInputClass : editableInputClass}`} name="username" type="text" value={isStudentAccount ? lockedUsername : undefined} defaultValue={isStudentAccount ? undefined : profile?.username || ''} readOnly={isStudentAccount} required />
                      {hasStudentId && (
                        <p className="mt-1 text-xs font-medium text-white/60">รหัสนักศึกษาถูกตั้งจากอีเมลมหาลัยและไม่สามารถแก้เองได้</p>
                      )}
                    </div>
                  </div>
                  {!isStudentAccount && (
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">รหัสนักศึกษา</label>
                      <input className={`${lockedInputClass} col-span-2 rounded-xl px-4 py-2 border text-sm`} type="text" value={studentIdDisplay} readOnly />
                    </div>
                  )}
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">ชื่อที่แสดง</label>
                    <div className="col-span-2">
                      <input className={`w-full rounded-xl px-4 py-2 border text-sm ${isStudentAccount ? lockedInputClass : editableInputClass}`} name="displayName" type="text" value={isStudentAccount ? lockedDisplayName : undefined} defaultValue={isStudentAccount ? undefined : profile?.full_name || ''} readOnly={isStudentAccount} required />
                      {isStudentAccount && (
                        <p className="mt-1 text-xs font-medium text-white/60">บัญชีนักศึกษาไม่สามารถแก้ชื่อผู้ใช้และชื่อที่แสดงได้</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">เบอร์โทรศัพท์</label>
                    <input className="col-span-2 rounded-xl px-4 py-2  border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="phone" type="tel" inputMode="tel" defaultValue={formatThaiPhoneInput(profile?.phone || '')} onChange={(event) => { event.currentTarget.value = formatThaiPhoneInput(event.currentTarget.value) }} pattern={THAI_PHONE_INPUT_PATTERN} title={THAI_PHONE_REQUIREMENTS_TEXT} required />
                  </div>
                  <div className="grid grid-cols-3 items-start gap-4">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider text-right mt-2">อีเมล</label>
                    <div className="col-span-2 space-y-2">
                      <input className="w-full rounded-xl px-4 py-2  border border-neutral-900/40 text-neutral-500 cursor-not-allowed select-none text-sm" type="email" value={email || ''} disabled />
                      
                      {/* ⚡ แสดงสถานะและปุ่มยืนยันอีเมลบน Desktop */}
                      <div>
                        {isEmailConfirmed ? (
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            ✓ Verified Email
                          </span>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-xl">
                            <span className="text-xs text-amber-400 font-medium">⚠️ ยังไม่ได้ยืนยันอีเมล</span>
                            <button
                              type="button"
                              onClick={handleResendEmail}
                              disabled={isPending}
                              className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              Resend Link
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 max-w-xl border-t border-neutral-800/80 pt-4 mt-2">
                  <Link href="/" className="border border-neutral-800 rounded-xl px-5 py-2 text-neutral-400  hover:text-orange-500 transition-all text-sm">ยกเลิก</Link>
                  <button type="submit" disabled={isPending} className="bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl px-6 py-2 text-black font-bold shadow-lg text-sm cursor-pointer transition-all ">
                    {isPending ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* DESKTOP TAB 2: AVATAR */}
          {activeTab === 'avatar' && (
            <div className="animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-neutral-800/80 ">
                <h3 className="text-lg font-black tracking-wide text-neutral-200">ตั้งค่ารูปโปรไฟล์</h3>
              </div>
              <div className="p-8 flex flex-col items-center gap-6 max-w-xl mx-auto py-12 text-center">
                <div className="relative cursor-pointer group active:scale-95 transition-transform" onClick={() => document.getElementById('avatar-file-desktop')?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="รูปโปรไฟล์" className="w-32 h-32 rounded-2xl object-cover border-2 border-orange-500 shadow-xl" />
                  ) : (
                    <div className="w-32 h-32 rounded-2xl  border border-neutral-800 flex items-center justify-center font-black text-orange-500 text-4xl">
                      {(profile?.full_name || profile?.username || email)?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-orange-500 text-black p-2 rounded-xl shadow-lg border-2 border-black text-xs font-bold">📷</div>
                </div>
                <p className="text-sm text-neutral-400">อัปโหลดรูปใหม่เพื่อเปลี่ยนรูปโปรไฟล์ของคุณ</p>
                <input type="file" id="avatar-file-desktop" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isPending} />
                <button type="button" disabled={isPending} onClick={() => document.getElementById('avatar-file-desktop')?.click()} className="bg-orange-500 hover:bg-orange-400 text-black active:scale-95 text-sm font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg ">
                  {isPending ? 'Uploading...' : '📁 Choose Image File'}
                </button>
              </div>
            </div>
          )}

          {/* DESKTOP TAB 3: PASSWORD */}
          {activeTab === 'password' && (
            <div className="animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-neutral-800/80 ">
                <h3 className="text-lg font-black tracking-wide text-neutral-200">ตั้งค่าความปลอดภัย</h3>
              </div>
              <form onSubmit={handleSubmitPassword} className="p-6 flex flex-col gap-5">
                <div className="space-y-4 max-w-xl">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">รหัสผ่านปัจจุบัน</label>
                    <input className="col-span-2 rounded-xl px-4 py-2  border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="oldPassword" type="password" required />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">รหัสผ่านใหม่</label>
                    <div className="col-span-2">
                      <input className="w-full rounded-xl px-4 py-2  border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="newPassword" type="password" value={newPasswordValue} onChange={(event) => setNewPasswordValue(event.target.value)} placeholder="รหัสผ่านใหม่ของคุณ" minLength={8} pattern={PASSWORD_PATTERN} title={PASSWORD_REQUIREMENTS_TEXT} required />
                      <PasswordRequirements password={newPasswordValue} className="mt-2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">ยืนยันรหัสผ่าน</label>
                    <input className="col-span-2 rounded-xl px-4 py-2  border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="confirmPassword" type="password" minLength={8} pattern={PASSWORD_PATTERN} title={PASSWORD_REQUIREMENTS_TEXT} required />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 max-w-xl border-t border-neutral-800/80 pt-4 mt-2">
                  <button type="submit" disabled={isPending} className="bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl px-6 py-2 text-black font-bold shadow-lg text-sm cursor-pointer transition-all ">
                    {isPending ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* DESKTOP TAB 4: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-neutral-800/80 ">
                <h3 className="text-lg font-black tracking-wide text-neutral-200">ตั้งค่าการแจ้งเตือน</h3>
              </div>
              <form onSubmit={handleSubmitNotifications} className="p-6 flex flex-col gap-5">
                <div className="max-w-2xl space-y-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {systemNotificationOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`cursor-pointer rounded-xl border p-4 transition ${
                          selectedSystemNotifications.includes(option.id)
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-neutral-800  hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedSystemNotifications.includes(option.id)}
                            onChange={() => toggleSystemNotification(option.id)}
                            className="mt-1 h-4 w-4 accent-orange-500"
                          />
                          <div>
                            <p className="text-sm font-black text-white">{option.label}</p>
                            <p className="mt-1 text-xs leading-5 text-neutral-500">{option.description}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="rounded-xl border border-neutral-800  p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <label htmlFor="custom-sound-desktop" className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                          Custom Sound
                        </label>
                        <input
                          id="custom-sound-desktop"
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={handleCustomNotificationAudioUpload}
                          disabled={isPending}
                        />
                        <p className="mt-1 text-xs text-neutral-500">อัปโหลดไฟล์เสียงแจ้งเตือน ความยาว 3-5 วินาที ขนาดไม่เกิน 2MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('custom-sound-desktop')?.click()}
                        disabled={isPending}
                        className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-black text-black transition hover:bg-orange-400  disabled:text-neutral-500"
                      >
                        {isPending ? 'Uploading...' : 'Add Sound File'}
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                      {customNotifications.length > 0 ? customNotifications.map((notification) => (
                        <div key={notification.id} className="rounded-xl border border-neutral-800 bg-black p-4">
                          <div className="mb-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">{notification.name}</p>
                              <p className="mt-0.5 text-xs text-neutral-500">{formatSoundDuration(notification.duration)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCustomNotification(notification)}
                              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/10"
                            >
                              ลบ
                            </button>
                          </div>
                          <audio controls src={notification.url} className="h-10 w-full" />
                        </div>
                      )) : (
                        <span className="text-sm text-neutral-500">ยังไม่มีไฟล์เสียงแจ้งเตือนที่เพิ่มเอง</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 max-w-2xl border-t border-neutral-800/80 pt-4 mt-2">
                  <button type="submit" disabled={isPending} className="bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl px-6 py-2 text-black font-bold shadow-lg text-sm cursor-pointer transition-all ">
                    {isPending ? 'Saving...' : 'Save Notifications'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* ALERT BOXES */}
      <div className="mt-4">
        {successMessage && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-center text-emerald-400 text-sm font-medium animate-in slide-in-from-bottom-2 duration-200">
            ✅ {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-center text-red-400 text-sm font-medium animate-in slide-in-from-bottom-2 duration-200">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>

    </div>
  )
}
