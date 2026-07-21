'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export default function Sidebar() {
  const pathname = usePathname();
  const [adminProfile, setAdminProfile] = useState<any>(null);
  
  // 🔥 State สำหรับเก็บข้อมูลร้านอาหาร และสถานะเปิด/ปิด Dropdown
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isRestaurantsOpen, setIsRestaurantsOpen] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Auto-open dropdown ถ้า pathname ปัจจุบันอยู่ในหมวดหมู่จัดการร้านอาหาร
  useEffect(() => {
    if (pathname.startsWith('/admin/restaurants')) {
      setIsRestaurantsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    const fetchCurrentAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username, full_name, avatar_url, role')
          .eq('id', user.id)
          .single();
        if (data) setAdminProfile(data);
      }
    };

    const fetchRestaurants = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('created_at', { ascending: false });
      
      if (data) setRestaurants(data);
    };

    fetchCurrentAdmin();
    fetchRestaurants();
  }, [supabase]);

  return (
    <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-800 p-6 flex flex-col justify-between shrink-0 h-auto md:min-h-[calc(100vh-68px)]">
      <div>
        {/* หัวข้อระบบ */}
        <div className="mb-6 border-b border-neutral-800 pb-4">
          <h1 className="text-xl font-black text-orange-500 tracking-wide uppercase">
            Admin Workspace
          </h1>
          <p className="text-xs text-gray-500 mt-1">FOOD ORDER KMUTNB</p>
        </div>

        {/* ส่วนแสดงผลโปรไฟล์ผู้ใช้งาน Admin */}
        <div className="mb-6 p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center gap-3">
          {adminProfile?.avatar_url ? (
            <img
              src={adminProfile.avatar_url}
              alt="Admin Avatar"
              className="w-9 h-9 rounded-full border border-orange-500 object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-sm font-bold text-black shrink-0">
              {(adminProfile?.full_name || adminProfile?.username || 'A')[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">
              {adminProfile?.full_name || adminProfile?.username || 'Admin'}
            </p>
            <span className="inline-block text-[9px] font-black px-1.5 py-0.2 bg-red-500/20 text-red-500 border border-red-500/40 rounded uppercase tracking-wide mt-0.5">
              {adminProfile?.role || 'admin'}
            </span>
          </div>
        </div>

        {/* รายการเมนูลิงก์เปลี่ยนหน้า */}
        <nav className="space-y-2">
          
          {/* 1. หน้าแรกแอดมิน */}
          <Link
            href="/admin"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
              pathname === '/admin'
                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                : 'text-gray-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>📊</span> หน้าแรกแอดมิน
          </Link>

          {/* 2. ข้อมูลผู้ใช้งาน */}
          <Link
            href="/admin/profiles"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
              pathname === '/admin/profiles' || pathname === '/admin/users'
                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                : 'text-gray-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>👥</span> ข้อมูลผู้ใช้งาน
          </Link>

          {/* 3. จัดการ Role & สิทธิ์ */}
          <Link
            href="/admin/roles"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
              pathname === '/admin/roles'
                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                : 'text-gray-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>🔑</span> จัดการ Role & สิทธิ์
          </Link>

          {/* 4. เปลี่ยนรหัสผ่านผู้ใช้งาน */}
          <Link
            href="/admin/change-password"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
              pathname === '/admin/change-password'
                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                : 'text-gray-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>🔐</span> เปลี่ยนรหัสผ่านผู้ใช้งาน
          </Link>

          {/* 🆕 5. ประวัติกิจกรรม (Activity Logs) */}
          <Link
            href="/admin/activity-logs"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
              pathname === '/admin/activity-logs'
                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                : 'text-gray-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>📜</span> ประวัติกิจกรรม
          </Link>
          
          {/* 6. จัดการร้านอาหาร (Accordion Dropdown) */}
          <div>
            <button
              onClick={() => setIsRestaurantsOpen(!isRestaurantsOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                pathname.startsWith('/admin/restaurants')
                  ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span>🏪</span> จัดการร้านอาหาร
              </div>
              <span className={`text-[10px] transition-transform duration-200 ${isRestaurantsOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {/* แสดงรายชื่อร้านอาหารย่อยลงมา */}
            {isRestaurantsOpen && (
              <div className="mt-1 ml-4 pl-2 border-l border-neutral-800 space-y-1 transition-all">
                <Link
                  href="/admin/restaurants"
                  className={`block px-4 py-2 rounded-md text-xs font-bold transition-all ${
                    pathname === '/admin/restaurants'
                      ? 'text-orange-500 bg-neutral-800/60'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-neutral-800/45'
                  }`}
                >
                  📋 ดูร้านอาหารทั้งหมด
                </Link>

                {restaurants.length > 0 ? (
                  restaurants.map((shop) => (
                    <Link
                      key={shop.id}
                      href={`/admin/restaurants/${shop.id}`}
                      className={`block px-4 py-2 rounded-md text-xs transition-all truncate ${
                        pathname === `/admin/restaurants/${shop.id}`
                          ? 'text-orange-400 font-bold bg-neutral-800/60'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-neutral-800/45'
                      }`}
                    >
                      📍 {shop.name}
                    </Link>
                  ))
                ) : (
                  <p className="text-[11px] text-gray-600 px-4 py-2 italic">ไม่มีข้อมูลร้านอาหาร</p>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* ปุ่มออกจากระบบ Admin */}
      <div className="mt-8 pt-4 border-t border-neutral-800">
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black text-red-400 bg-red-950/20 border border-red-900/30 hover:bg-red-950/45 hover:text-red-300 transition-all shadow-md uppercase tracking-wider"
        >
          <span>🚪</span> ออกจากระบบ Admin
        </Link>
      </div>
    </aside>
  );
}