'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  const links = [
    { href: '/about', label: 'เกี่ยวกับเรา' },
    { href: '/terms-of-use', label: 'เงื่อนไขการใช้งาน' },
    { href: '/privacy-policy', label: 'นโยบายความเป็นส่วนตัว' },
    { href: '/contact', label: 'ติดต่อเรา' },
  ];

  return (
    <footer className="bg-black text-gray-500 w-full border-t border-neutral-900 mt-auto">
      <div className="w-full px-3 py-5 sm:px-6 md:py-6 flex flex-col lg:flex-row justify-between items-center gap-4">
        
        <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
          <span className="text-orange-500 font-black text-lg tracking-wide">shydeveloper.xyz</span>
          <p className="text-[11px] text-gray-600 mt-1">
            © {new Date().getFullYear()} แอปฟู้ดออเดอร์ สงวนลิขสิทธิ์
          </p>
          <p className="text-[11px] text-gray-600 mt-1">
            สร้างด้วย Next.js, Tailwind CSS และ Supabase
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 text-center text-xs font-bold sm:flex sm:flex-wrap sm:justify-center sm:text-sm lg:w-auto lg:gap-4">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-black'
                    : 'text-gray-500  hover:text-orange-400'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

      </div>
    </footer>
  );
}
