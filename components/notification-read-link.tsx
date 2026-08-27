'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

interface NotificationReadLinkProps {
  children: ReactNode
  className?: string
  href: string
  notificationId: string
}

export default function NotificationReadLink({
  children,
  className,
  href,
  notificationId,
}: NotificationReadLinkProps) {
  const markRead = () => {
    void fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: notificationId }),
      keepalive: true,
    }).catch(() => undefined)
  }

  return (
    <Link href={href} onClick={markRead} className={className}>
      {children}
    </Link>
  )
}
