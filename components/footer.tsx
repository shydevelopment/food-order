'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  const links = [
    { href: '/aboutusPage', label: 'About Us' },
    { href: '/termsofusePage', label: 'Terms of Use' },
    { href: '/privacypolicyPage', label: 'Privacy Policy' },
    { href: '/contactPage', label: 'Contact Us' },
  ];

  return (
    <footer className="bg-black text-gray-500 w-full border-t border-neutral-900 mt-auto">
      <div className="w-full px-6 py-6 md:py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex flex-col items-center md:items-start">
          <span className="text-orange-500 font-black text-lg tracking-wide">shydeveloper.xyz</span>
          <p className="text-[11px] text-gray-600 mt-1">
            © {new Date().getFullYear()} FoodOrder App. All rights reserved.
          </p>
          <p className="text-[11px] text-gray-600 mt-1">
            Built with Next.js , Tailwindcss & Supabase
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 text-sm font-bold md:gap-4">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-black'
                    : 'text-gray-500 hover:bg-neutral-900 hover:text-orange-400'
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
