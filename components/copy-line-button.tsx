'use client'

import { useState } from 'react'

type CopyLineButtonProps = {
  lineId: string
}

export default function CopyLineButton({ lineId }: CopyLineButtonProps) {
  const [copied, setCopied] = useState(false)

  const copyLineId = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lineId)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = lineId
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      alert('คัดลอกไอดีไลน์ไม่สำเร็จ กรุณาคัดลอกด้วยตัวเอง')
    }
  }

  return (
    <button
      type="button"
      onClick={copyLineId}
      className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-left font-black text-emerald-400 transition-colors hover:bg-emerald-500 hover:text-black"
    >
      <span className="block text-sm">{copied ? 'คัดลอกแล้ว' : 'คัดลอกไอดี LINE'}</span>
      <span className="mt-1 block text-xs opacity-80">{lineId}</span>
    </button>
  )
}
