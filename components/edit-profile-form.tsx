'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

interface EditableProfile {
  username: string | null
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role?: string | null
}

interface EditProfileFormProps {
  profile: EditableProfile | null
  email: string | undefined
  isEmailConfirmed?: boolean
  isStudentAccount?: boolean
  studentUsername?: string | null
  updateAction: (formData: FormData) => Promise<{ success: boolean; message?: string }>
  resendAction?: () => Promise<{ success: boolean; message?: string }>
}

export default function EditProfileForm({
  profile,
  email,
  isEmailConfirmed = false,
  isStudentAccount = false,
  studentUsername,
  updateAction,
  resendAction,
}: EditProfileFormProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'avatar' | 'password' | null>('profile')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)
  const lockedUsername = studentUsername || profile?.username || ''
  const lockedDisplayName = profile?.full_name || ''
  const lockedInputClass = 'cursor-not-allowed border-white/20 bg-white/10 text-white/70'
  const editableInputClass = 'bg-neutral-950 border-neutral-800 focus:outline-none focus:border-orange-500 text-white'

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const toggleTab = (tab: 'profile' | 'avatar' | 'password') => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setActiveTab((prev) => (prev === tab ? null : tab))
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
      const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`

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
        window.location.href = '/?message=Profile updated successfully!'
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

    if (newPassword.length < 6) {
      setErrorMessage('The new password must be at least 6 characters long.')
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
      window.location.href = '/login?message=Password changed successfully! Please log in again using your new password.'

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while updating the password.'
      setErrorMessage(message)
      setIsPending(false)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto text-white p-2">
      
      {/* Header Profile */}
      <div className="mb-6 p-4 bg-neutral-900 border border-neutral-800/80 rounded-2xl flex items-center gap-4 shadow-lg">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-12 h-12 sm:w-14 sm:h-12 rounded-xl object-cover border border-orange-500/40 shrink-0" />
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
        <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => toggleTab('profile')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm bg-neutral-900 hover:bg-neutral-800/60 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="text-base">👤</span>
              <span className={activeTab === 'profile' ? 'text-orange-500' : 'text-neutral-300'}>Edit Profile</span>
            </span>
            <span className={`text-xs text-neutral-400 transition-transform duration-300 ${activeTab === 'profile' ? 'rotate-180 text-orange-500' : ''}`}>▼</span>
          </button>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${activeTab === 'profile' ? 'grid-rows-[1fr] opacity-100 border-t border-neutral-800/60' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden bg-neutral-950/50">
              <form onSubmit={handleSubmitProfile} className="p-4 flex flex-col gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Username</label>
                    <input className={`w-full rounded-xl px-4 py-2.5 border text-sm ${isStudentAccount ? lockedInputClass : editableInputClass}`} name="username" type="text" value={isStudentAccount ? lockedUsername : undefined} defaultValue={isStudentAccount ? undefined : profile?.username || ''} readOnly={isStudentAccount} required />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Display Name</label>
                    <input className={`w-full rounded-xl px-4 py-2.5 border text-sm ${isStudentAccount ? lockedInputClass : editableInputClass}`} name="displayName" type="text" value={isStudentAccount ? lockedDisplayName : undefined} defaultValue={isStudentAccount ? undefined : profile?.full_name || ''} readOnly={isStudentAccount} required />
                    {isStudentAccount && (
                      <p className="mt-1 text-[11px] font-medium text-white/60">บัญชี Student ไม่สามารถแก้ Username และ Display Name ได้</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Phone Number</label>
                    <input className="w-full rounded-xl px-4 py-2.5 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="phone" type="tel" defaultValue={profile?.phone || ''} pattern="^0[0-9]{8,9}$" required />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Email Address</label>
                    <input className="w-full rounded-xl px-4 py-2.5 bg-neutral-950 border border-neutral-900/40 text-neutral-500 cursor-not-allowed select-none text-sm" type="email" value={email || ''} disabled />

                    {/* ⚡ แสดงสถานะและปุ่มยืนยันอีเมลบนมือถือ */}
                    <div className="mt-2">
                      {isEmailConfirmed ? (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                          ✓ Verified Email
                        </span>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-xl">
                          <span className="text-[11px] text-amber-400 font-medium">⚠️ Unverified Email</span>
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
                <button type="submit" disabled={isPending} className="w-full bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl py-2.5 text-black font-bold shadow-lg text-sm transition-all mt-2 cursor-pointer disabled:bg-neutral-800">
                  {isPending ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ACCORDION 2: AVATAR */}
        <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => toggleTab('avatar')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm bg-neutral-900 hover:bg-neutral-800/60 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="text-base">🖼️</span>
              <span className={activeTab === 'avatar' ? 'text-orange-500' : 'text-neutral-300'}>Change Avatar</span>
            </span>
            <span className={`text-xs text-neutral-400 transition-transform duration-300 ${activeTab === 'avatar' ? 'rotate-180 text-orange-500' : ''}`}>▼</span>
          </button>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${activeTab === 'avatar' ? 'grid-rows-[1fr] opacity-100 border-t border-neutral-800/60' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden bg-neutral-950/50">
              <div className="p-6 flex flex-col items-center gap-4 text-center">
                <div className="relative cursor-pointer group active:scale-95 transition-transform" onClick={() => document.getElementById('avatar-file-mobile')?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-28 h-28 rounded-2xl object-cover border-2 border-orange-500 shadow-xl" />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center font-black text-orange-500 text-3xl">
                      {(profile?.full_name || profile?.username || email)?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-orange-500 text-black p-1.5 rounded-lg shadow-lg text-xs font-bold">📷</div>
                </div>
                <p className="text-xs text-neutral-400">Tap image or click button below to upload avatar</p>
                <input type="file" id="avatar-file-mobile" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isPending} />
                <button type="button" disabled={isPending} onClick={() => document.getElementById('avatar-file-mobile')?.click()} className="w-full bg-orange-500 hover:bg-orange-400 text-black active:scale-95 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-lg disabled:bg-neutral-800">
                  {isPending ? 'Uploading...' : '📁 Choose Image File'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ACCORDION 3: PASSWORD */}
        <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => toggleTab('password')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm bg-neutral-900 hover:bg-neutral-800/60 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="text-base">🔒</span>
              <span className={activeTab === 'password' ? 'text-orange-500' : 'text-neutral-300'}>Change Password</span>
            </span>
            <span className={`text-xs text-neutral-400 transition-transform duration-300 ${activeTab === 'password' ? 'rotate-180 text-orange-500' : ''}`}>▼</span>
          </button>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${activeTab === 'password' ? 'grid-rows-[1fr] opacity-100 border-t border-neutral-800/60' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden bg-neutral-950/50">
              <form onSubmit={handleSubmitPassword} className="p-4 flex flex-col gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Current Password</label>
                    <input className="w-full rounded-xl px-4 py-2.5 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="oldPassword" type="password" required />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">New Password</label>
                    <input className="w-full rounded-xl px-4 py-2.5 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="newPassword" type="password" placeholder="At least 6 characters" required />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Confirm Password</label>
                    <input className="w-full rounded-xl px-4 py-2.5 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="confirmPassword" type="password" required />
                  </div>
                </div>
                <button type="submit" disabled={isPending} className="w-full bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl py-2.5 text-black font-bold shadow-lg text-sm transition-all mt-2 cursor-pointer disabled:bg-neutral-800">
                  {isPending ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>

      {/* 💻 2. LAYOUT สำหรับจอคอมพิวเตอร์ DESKTOP */}
      <div className="hidden md:flex gap-6 items-start">
        
        {/* SIDEBAR MENU */}
        <div className="w-64 bg-neutral-900 border border-neutral-800/80 rounded-2xl p-4 flex flex-col gap-2 shrink-0 shadow-lg">
          <button type="button" onClick={() => { setActiveTab('profile'); setErrorMessage(null); setSuccessMessage(null); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left font-bold text-sm transition-all cursor-pointer ${activeTab === 'profile' ? 'bg-orange-500 text-black shadow-md shadow-orange-500/10' : 'text-neutral-400 hover:bg-neutral-800/60'}`}>
            <span>👤</span> Profile
          </button>
          <button type="button" onClick={() => { setActiveTab('avatar'); setErrorMessage(null); setSuccessMessage(null); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left font-bold text-sm transition-all cursor-pointer ${activeTab === 'avatar' ? 'bg-orange-500 text-black shadow-md shadow-orange-500/10' : 'text-neutral-400 hover:bg-neutral-800/60'}`}>
            <span>🖼️</span> Avatar
          </button>
          <button type="button" onClick={() => { setActiveTab('password'); setErrorMessage(null); setSuccessMessage(null); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left font-bold text-sm transition-all cursor-pointer ${activeTab === 'password' ? 'bg-orange-500 text-black shadow-md shadow-orange-500/10' : 'text-neutral-400 hover:bg-neutral-800/60'}`}>
            <span>🔒</span> Password
          </button>
        </div>

        {/* CONTENT CARD */}
        <div className="flex-1 bg-neutral-900 border border-neutral-800/80 rounded-2xl shadow-xl overflow-hidden">
          
          {/* DESKTOP TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/40">
                <h3 className="text-lg font-black tracking-wide text-neutral-200">User Information</h3>
              </div>
              <form onSubmit={handleSubmitProfile} className="p-6 flex flex-col gap-5">
                <div className="space-y-4 max-w-xl">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Username</label>
                    <input className={`col-span-2 rounded-xl px-4 py-2 border text-sm ${isStudentAccount ? lockedInputClass : editableInputClass}`} name="username" type="text" value={isStudentAccount ? lockedUsername : undefined} defaultValue={isStudentAccount ? undefined : profile?.username || ''} readOnly={isStudentAccount} required />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Display Name</label>
                    <div className="col-span-2">
                      <input className={`w-full rounded-xl px-4 py-2 border text-sm ${isStudentAccount ? lockedInputClass : editableInputClass}`} name="displayName" type="text" value={isStudentAccount ? lockedDisplayName : undefined} defaultValue={isStudentAccount ? undefined : profile?.full_name || ''} readOnly={isStudentAccount} required />
                      {isStudentAccount && (
                        <p className="mt-1 text-xs font-medium text-white/60">บัญชี Student ไม่สามารถแก้ Username และ Display Name ได้</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Phone Number</label>
                    <input className="col-span-2 rounded-xl px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="phone" type="tel" defaultValue={profile?.phone || ''} pattern="^0[0-9]{8,9}$" required />
                  </div>
                  <div className="grid grid-cols-3 items-start gap-4">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider text-right mt-2">Email Address</label>
                    <div className="col-span-2 space-y-2">
                      <input className="w-full rounded-xl px-4 py-2 bg-neutral-950 border border-neutral-900/40 text-neutral-500 cursor-not-allowed select-none text-sm" type="email" value={email || ''} disabled />
                      
                      {/* ⚡ แสดงสถานะและปุ่มยืนยันอีเมลบน Desktop */}
                      <div>
                        {isEmailConfirmed ? (
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            ✓ Verified Email
                          </span>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-xl">
                            <span className="text-xs text-amber-400 font-medium">⚠️ Unverified Email</span>
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
                  <Link href="/" className="border border-neutral-800 rounded-xl px-5 py-2 text-neutral-400 hover:bg-neutral-950 hover:text-orange-500 transition-all text-sm">Cancel</Link>
                  <button type="submit" disabled={isPending} className="bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl px-6 py-2 text-black font-bold shadow-lg text-sm cursor-pointer transition-all disabled:bg-neutral-800">
                    {isPending ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* DESKTOP TAB 2: AVATAR */}
          {activeTab === 'avatar' && (
            <div className="animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/40">
                <h3 className="text-lg font-black tracking-wide text-neutral-200">Avatar Settings</h3>
              </div>
              <div className="p-8 flex flex-col items-center gap-6 max-w-xl mx-auto py-12 text-center">
                <div className="relative cursor-pointer group active:scale-95 transition-transform" onClick={() => document.getElementById('avatar-file-desktop')?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-32 h-32 rounded-2xl object-cover border-2 border-orange-500 shadow-xl" />
                  ) : (
                    <div className="w-32 h-32 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center font-black text-orange-500 text-4xl">
                      {(profile?.full_name || profile?.username || email)?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-orange-500 text-black p-2 rounded-xl shadow-lg border-2 border-black text-xs font-bold">📷</div>
                </div>
                <p className="text-sm text-neutral-400">Upload a new image to change your profile picture</p>
                <input type="file" id="avatar-file-desktop" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isPending} />
                <button type="button" disabled={isPending} onClick={() => document.getElementById('avatar-file-desktop')?.click()} className="bg-orange-500 hover:bg-orange-400 text-black active:scale-95 text-sm font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg disabled:bg-neutral-800">
                  {isPending ? 'Uploading...' : '📁 Choose Image File'}
                </button>
              </div>
            </div>
          )}

          {/* DESKTOP TAB 3: PASSWORD */}
          {activeTab === 'password' && (
            <div className="animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/40">
                <h3 className="text-lg font-black tracking-wide text-neutral-200">Security Settings</h3>
              </div>
              <form onSubmit={handleSubmitPassword} className="p-6 flex flex-col gap-5">
                <div className="space-y-4 max-w-xl">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Current Password</label>
                    <input className="col-span-2 rounded-xl px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="oldPassword" type="password" required />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">New Password</label>
                    <input className="col-span-2 rounded-xl px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="newPassword" type="password" placeholder="At least 6 characters" required />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Confirm Password</label>
                    <input className="col-span-2 rounded-xl px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm" name="confirmPassword" type="password" required />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 max-w-xl border-t border-neutral-800/80 pt-4 mt-2">
                  <button type="submit" disabled={isPending} className="bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-xl px-6 py-2 text-black font-bold shadow-lg text-sm cursor-pointer transition-all disabled:bg-neutral-800">
                    {isPending ? 'Updating...' : 'Update Password'}
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
