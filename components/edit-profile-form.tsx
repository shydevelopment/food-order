'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

interface EditProfileFormProps {
  profile: any
  email: string | undefined
  updateAction: (formData: FormData) => Promise<{ success: boolean; message?: string }>
}

export default function EditProfileForm({ profile, email, updateAction }: EditProfileFormProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'avatar' | 'password'>('profile')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Function to handle avatar image upload
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
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while uploading the image.')
    } finally {
      setIsPending(false)
    }
  }

  // Function to handle saving general profile data (Username, Display Name, Phone)
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
    } catch (err) {
      setErrorMessage('An error occurred while connecting to the server.')
    } finally {
      setIsPending(false)
    }
  }

  // 🔒 Function to handle changing password (Bug fix version: handles resets and forced logouts)
  const handleSubmitPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    // 🛠️ Bug Fix: Cache the form element to prevent data loss after the await statement
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
      // 1. Re-authenticate to verify current password
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: email || '',
        password: oldPassword,
      })

      if (verifyError) {
        setErrorMessage('Incorrect current password. Password update failed.')
        setIsPending(false)
        return
      }

      // 2. Commit the new password change to the system
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
      })
      
      if (updateError) throw updateError

      // Safe and sound: Reset the input elements using our cached form target reference
      formTarget.reset() 

      // 💡 3. Enforce re-authentication: Log out and push user to login with a warning query parameter
      await supabase.auth.signOut()
      window.location.href = '/login?message=Password changed successfully! Please log in again using your new password.'

    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while updating the password.')
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl mx-auto items-start text-white p-2">
      
      {/* ==================== 🗂️ LEFT SIDE: SIDEBAR MENU ==================== */}
      <div className="w-full md:w-64 bg-neutral-900 border border-neutral-800/60 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3 p-2 border-b border-neutral-800/80 pb-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-10 h-10 rounded-lg object-cover border border-orange-500/30" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center font-black text-black text-base">
              {(profile?.full_name || profile?.username || email)?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h4 className="font-bold text-sm text-neutral-200 truncate">{profile?.full_name || profile?.username || 'User'}</h4>
            <span className="text-[11px] text-neutral-500 font-medium">Settings</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 text-sm font-medium">
          <button type="button" onClick={() => { setActiveTab('profile'); setErrorMessage(null); setSuccessMessage(null); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-all cursor-pointer ${activeTab === 'profile' ? 'bg-neutral-800 text-orange-500 font-bold' : 'text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200'}`}>
            👤 <span>Profile</span>
          </button>
          <button type="button" onClick={() => { setActiveTab('avatar'); setErrorMessage(null); setSuccessMessage(null); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-all cursor-pointer ${activeTab === 'avatar' ? 'bg-neutral-800 text-orange-500 font-bold' : 'text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200'}`}>
            🖼️ <span>Avatar</span>
          </button>
          <button type="button" onClick={() => { setActiveTab('password'); setErrorMessage(null); setSuccessMessage(null); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-all cursor-pointer ${activeTab === 'password' ? 'bg-neutral-800 text-orange-500 font-bold' : 'text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200'}`}>
            🔒 <span>Password</span>
          </button>
        </nav>
      </div>

      {/* ==================== 📝 RIGHT SIDE: CONTENT CARD FORM ==================== */}
      <div className="flex-1 w-full bg-neutral-900 border border-neutral-800/60 rounded-xl shadow-xl overflow-hidden">
        
        {/* TAB 1: PROFILE INFORMATION */}
        {activeTab === 'profile' && (
          <>
            <div className="px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/40">
              <h3 className="text-lg font-black tracking-wide text-neutral-200">User Information</h3>
            </div>
            <form onSubmit={handleSubmitProfile} className="p-6 flex flex-col gap-5">
              <div className="space-y-4 max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider sm:text-right" htmlFor="username">Username</label>
                  <div className="sm:col-span-2">
                    <input className="w-full rounded-md px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all text-sm" name="username" type="text" defaultValue={profile?.username || ''} required />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider sm:text-right" htmlFor="displayName">Display Name</label>
                  <div className="sm:col-span-2">
                    <input className="w-full rounded-md px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all text-sm" name="displayName" type="text" defaultValue={profile?.full_name || ''} required />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider sm:text-right" htmlFor="phone">Phone Number</label>
                  <div className="sm:col-span-2">
                    <input className="w-full rounded-md px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder:text-neutral-600 transition-all text-sm" name="phone" type="tel" defaultValue={profile?.phone || ''} pattern="^0[0-9]{8,9}$" required />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider sm:text-right">Email Address</label>
                  <div className="sm:col-span-2">
                    <input className="w-full rounded-md px-4 py-2 bg-neutral-950 border border-neutral-900/40 text-neutral-500 cursor-not-allowed select-none text-sm" type="email" value={email || ''} disabled />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 max-w-xl border-t border-neutral-800/60 pt-4 mt-2">
                <Link href="/" className="w-full sm:w-auto text-center border border-neutral-800 rounded-md px-5 py-2 text-neutral-400 hover:bg-neutral-950 hover:text-orange-500 hover:border-orange-500 transition-all text-sm">Cancel</Link>
                <button type="submit" disabled={isPending} className="w-full sm:w-auto bg-orange-500 rounded-md px-6 py-2 text-black hover:bg-orange-600 font-bold shadow-lg text-sm flex items-center justify-center gap-2 cursor-pointer">
                  <span>{isPending ? 'Saving...' : 'Save'}</span>
                  {!isPending && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>}
                </button>
              </div>
            </form>
          </>
        )}

        {/* TAB 2: AVATAR MANAGEMENT */}
        {activeTab === 'avatar' && (
          <>
            <div className="px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/40">
              <h3 className="text-lg font-black tracking-wide text-neutral-200">Avatar Settings</h3>
            </div>
            <div className="p-6 flex flex-col items-center gap-6 max-w-xl mx-auto py-12">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar Large" className="w-32 h-32 rounded-2xl object-cover border-2 border-orange-500 shadow-xl shadow-orange-500/10" />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center font-black text-orange-500 text-4xl">
                    {(profile?.full_name || profile?.username || email)?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-neutral-400">Upload a new image to change your profile picture</p>
                <div className="pt-2 flex gap-3 justify-center">
                  <input type="file" id="avatar-file-input" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isPending} />
                  <button type="button" disabled={isPending} onClick={() => document.getElementById('avatar-file-input')?.click()} className="bg-orange-500 text-black text-xs font-bold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors cursor-pointer shadow-md disabled:bg-neutral-800">
                    {isPending ? 'Uploading...' : 'Upload Avatar'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 3: PASSWORD CHANGING */}
        {activeTab === 'password' && (
          <>
            <div className="px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/40">
              <h3 className="text-lg font-black tracking-wide text-neutral-200">Security Settings</h3>
            </div>
            
            <form onSubmit={handleSubmitPassword} className="p-6 flex flex-col gap-5">
              <div className="space-y-4 max-w-xl">
                
                {/* Current Password Field */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider sm:text-right" htmlFor="oldPassword">
                    Current Password
                  </label>
                  <div className="sm:col-span-2">
                    <input 
                      className="w-full rounded-md px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm transition-all placeholder:text-neutral-700" 
                      name="oldPassword" 
                      type="password" 
                      placeholder="Your current password" 
                      required 
                    />
                  </div>
                </div>

                {/* New Password Field */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider sm:text-right" htmlFor="newPassword">
                    New Password
                  </label>
                  <div className="sm:col-span-2">
                    <input 
                      className="w-full rounded-md px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm transition-all placeholder:text-neutral-700" 
                      name="newPassword" 
                      type="password" 
                      placeholder="New password (at least 6 characters)" 
                      required 
                    />
                  </div>
                </div>

                {/* Confirm New Password Field */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider sm:text-right" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <div className="sm:col-span-2">
                    <input 
                      className="w-full rounded-md px-4 py-2 bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-orange-500 text-white text-sm transition-all placeholder:text-neutral-700" 
                      name="confirmPassword" 
                      type="password" 
                      placeholder="Confirm your new password" 
                      required 
                    />
                  </div>
                </div>

              </div>

              {/* Update Password Button */}
              <div className="flex justify-end gap-3 max-w-xl border-t border-neutral-800/60 pt-4 mt-2">
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="bg-orange-500 rounded-md px-6 py-2 text-black hover:bg-orange-600 disabled:bg-neutral-800 disabled:text-neutral-600 transition-colors font-bold text-sm cursor-pointer shadow-lg shadow-orange-500/10"
                >
                  {isPending ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Green alert box for success */}
        {successMessage && (
          <div className="p-4 bg-emerald-950/30 border-t border-emerald-900/40 text-center text-emerald-400 text-sm font-medium">
            ✅ {successMessage}
          </div>
        )}

        {/* Red alert box for errors */}
        {errorMessage && (
          <div className="p-4 bg-red-950/20 border-t border-red-900/40 text-center text-red-400 text-sm font-medium">
            ⚠️ {errorMessage}
          </div>
        )}

      </div>
    </div>
  )
}