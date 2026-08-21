'use client'

import { useFormStatus } from 'react-dom'

interface GoogleProfileFormProps {
  saveAction: (formData: FormData) => Promise<never>
  email: string
  username: string
  displayName: string
  phone?: string | null
  isStudent: boolean
  message?: string
}

function SaveButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-black shadow-lg shadow-orange-500/10 transition-all hover:bg-orange-400 active:scale-95 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลและเข้าเว็บ'}
    </button>
  )
}

export default function GoogleProfileForm({
  saveAction,
  email,
  username,
  displayName,
  phone,
  isStudent,
  message,
}: GoogleProfileFormProps) {
  const lockedClass = 'cursor-not-allowed border-white/20 bg-white/10 text-white/70'
  const editableClass = 'border-neutral-800 bg-neutral-950 text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center justify-center px-4 py-10 text-white">
      <form action={saveAction} className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-widest text-orange-500">Google Sign Up</p>
          <h1 className="mt-2 text-2xl font-black">กรอกข้อมูลบัญชี Google</h1>
          <p className="mt-1 text-sm text-neutral-400">
            ระบบดึงอีเมลและชื่อจาก Google ให้แล้ว ตรวจสอบข้อมูลก่อนเข้าใช้งาน
          </p>
        </div>

        {isStudent && (
          <div className="mb-5 rounded-xl border border-white/20 bg-white/10 p-4 text-sm text-white">
            บัญชีนี้เป็นอีเมลมหาลัย ระบบจะตั้ง role เป็น STUDENT และล็อก Username / Display Name ตามข้อมูล Google
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-400">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full rounded-xl border border-neutral-900 bg-neutral-900/70 px-4 py-3 text-sm text-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-400">Username</label>
            <input
              name="username"
              type="text"
              defaultValue={username}
              readOnly={isStudent}
              required
              className={`w-full rounded-xl border px-4 py-3 text-sm ${isStudent ? lockedClass : editableClass}`}
            />
            {isStudent && (
              <p className="mt-1 text-xs text-white/60">ตัวอย่าง: s6614012620383@email.kmutnb.ac.th จะใช้ username เป็น 6614012620383</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-400">Display Name</label>
            <input
              name="displayName"
              type="text"
              defaultValue={displayName}
              readOnly={isStudent}
              required
              className={`w-full rounded-xl border px-4 py-3 text-sm ${isStudent ? lockedClass : editableClass}`}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-400">Phone Number</label>
            <input
              name="phone"
              type="tel"
              defaultValue={phone || ''}
              placeholder="0812345678"
              pattern="^0[0-9]{8,9}$"
              title="กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (ขึ้นต้นด้วย 0 และมีความยาว 9-10 หลัก)"
              required
              className={`w-full rounded-xl border px-4 py-3 text-sm ${editableClass}`}
            />
          </div>
        </div>

        {message && (
          <p className="mt-5 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-center text-sm font-bold text-red-400">
            {message}
          </p>
        )}

        <div className="mt-6 flex justify-end border-t border-neutral-800 pt-5">
          <SaveButton />
        </div>
      </form>
    </div>
  )
}
