import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-black text-gray-500 w-full border-t border-neutral-900 mt-auto">
      <div className="w-full px-6 py-6 md:py-8 flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex flex-col items-center md:items-start">
          <span className="text-orange-500 font-black text-lg tracking-wide">FOOD <span className="text-white">ORDER</span> KMUTNB 🍔</span>
          <p className="text-[11px] text-gray-600 mt-1">
            © {new Date().getFullYear()} FoodOrder App. All rights reserved.
          </p>
          <p className="text-[11px] text-gray-600 mt-1">
            Built with Next.js , Tailwindcss & Supabase
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-sm">
          <a href="#" className="hover:text-orange-400 transition-colors">เกี่ยวกับเรา</a>
          <a href="#" className="hover:text-orange-400 transition-colors">เงื่อนไขการใช้งาน</a>
          <a href="#" className="hover:text-orange-400 transition-colors">นโยบายความเป็นส่วนตัว</a>
          <a href="#" className="hover:text-orange-400 transition-colors">ติดต่อสนับสนุน</a>
        </div>

      </div>
    </footer>
  );
}