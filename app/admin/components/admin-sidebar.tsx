'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

interface AdminProfile {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface RestaurantSummary {
  id: string;
  name: string;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [isRestaurantsOpen, setIsRestaurantsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  useEffect(() => {
    if (pathname.startsWith('/admin/restaurants')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRestaurantsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fetchAdminData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: restaurantRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, full_name, avatar_url, role')
          .eq('id', user.id)
          .single(),
        supabase
          .from('restaurants')
          .select('id, name')
          .order('created_at', { ascending: false }),
      ]);

      if (profile) setAdminProfile(profile);
      if (restaurantRows) setRestaurants(restaurantRows);
    };

    fetchAdminData();
  }, [supabase]);

  return (
    <aside className="w-full lg:w-72 bg-neutral-900 border-b lg:border-b-0 lg:border-r border-neutral-800 p-4 lg:p-6 flex flex-col justify-between shrink-0 h-auto lg:min-h-[calc(100vh-68px)] relative">
      <div>
        <div className="flex items-center justify-between gap-3 pb-3 lg:pb-4 border-b border-neutral-800">
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-black text-orange-500 tracking-wide uppercase">
              Admin Workspace
            </h1>
            <p className="text-[10px] lg:text-xs text-gray-500">FOOD ORDER KMUTNB</p>
          </div>

          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 text-xs font-bold text-gray-300 hover:text-white border border-neutral-700 active:scale-95 transition-all"
            aria-label="Toggle Admin Menu"
          >
            <span>{isMobileOpen ? 'ปิด' : 'เมนู'}</span>
          </button>
        </div>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out lg:block ${
            isMobileOpen ? 'grid-rows-[1fr] opacity-100 pt-4' : 'grid-rows-[0fr] opacity-0 lg:opacity-100 lg:pt-4'
          }`}
        >
          <div className="overflow-hidden lg:overflow-visible">
            <div className="mb-6 p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center gap-3">
              {adminProfile?.avatar_url ? (
                <img
                  src={adminProfile.avatar_url}
                  alt="Admin Avatar"
                  className="w-9 h-9 rounded-full border border-orange-500 object-cover shrink-0"
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
                  ADMIN
                </span>
              </div>
            </div>

            <nav className="space-y-2">
              <Link
                href="/admin"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  pathname === '/admin'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                    <span className="shrink-0">📊</span> <span className="min-w-0 truncate">หน้าแรกแอดมิน</span>
              </Link>

              <Link
                href="/admin/orders"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  pathname === '/admin/orders'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span className="shrink-0">🧾</span> <span className="min-w-0 truncate">รับออเดอร์</span>
              </Link>

              <Link
                href="/admin/profiles"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  pathname === '/admin/profiles' || pathname === '/admin/users'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span className="shrink-0">👥</span> <span className="min-w-0 truncate">ข้อมูลผู้ใช้งาน</span>
              </Link>

              <Link
                href="/admin/roles"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  pathname === '/admin/roles'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span className="shrink-0">🔑</span> <span className="min-w-0 truncate">จัดการ Role & สิทธิ์</span>
              </Link>

              <Link
                href="/admin/restaurant-access"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  pathname === '/admin/restaurant-access'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span className="shrink-0">🧩</span> <span className="min-w-0 truncate">สิทธิ์ร้านอาหาร</span>
              </Link>

              <Link
                href="/admin/change-password"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  pathname === '/admin/change-password'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span className="shrink-0">🔐</span> <span className="min-w-0 truncate">เปลี่ยนรหัสผ่านผู้ใช้งาน</span>
              </Link>

              <Link
                href="/admin/activity-logs"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  pathname === '/admin/activity-logs'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span className="shrink-0">📜</span> <span className="min-w-0 truncate">ประวัติกิจกรรม</span>
              </Link>

              <div>
                <button
                  onClick={() => setIsRestaurantsOpen(!isRestaurantsOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                    pathname.startsWith('/admin/restaurants')
                      ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="shrink-0">🏪</span> <span className="min-w-0 truncate">จัดการร้านอาหาร</span>
                  </div>
                  <span className={`text-[10px] transition-transform duration-200 ${isRestaurantsOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {isRestaurantsOpen && (
                  <div className="mt-1 ml-4 pl-2 border-l border-neutral-800 space-y-1 transition-all">
                    <Link
                      href="/admin/restaurants"
                      className={`block px-4 py-2 rounded-md text-xs font-bold transition-all active:scale-95 ${
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
                          className={`block px-4 py-2 rounded-md text-xs transition-all truncate active:scale-95 ${
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

            <div className="mt-8 pt-4 border-t border-neutral-800">
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black text-red-400 bg-red-950/20 border border-red-900/30 hover:bg-red-950/45 hover:text-red-300 active:scale-95 transition-all shadow-md uppercase tracking-wider"
              >
                <span>🚪</span> ออกจากหน้า ADMIN
              </Link>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
