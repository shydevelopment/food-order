'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

interface RestaurantProfile {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: string | null;
}

interface RestaurantSummary {
  id: string;
  name: string;
  access_level?: string;
}

export default function RestaurantSidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fetchRestaurantWorkspace = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url, email, role')
        .eq('id', user.id)
        .single();

      const { data: accessRows } = await supabase
        .from('restaurant_members')
        .select('restaurant_id, access_level')
        .eq('user_id', user.id);

      const restaurantIds = (accessRows || []).map((row) => row.restaurant_id);
      const accessByRestaurantId = new Map((accessRows || []).map((row) => [row.restaurant_id, row.access_level]));
      const restaurantMap = new Map<string, RestaurantSummary>();

      if (restaurantIds.length > 0) {
        const { data } = await supabase
          .from('restaurants')
          .select('id, name')
          .in('id', restaurantIds)
          .order('name', { ascending: true });

        (data || []).forEach((restaurant) => {
          restaurantMap.set(restaurant.id, {
            ...restaurant,
            access_level: accessByRestaurantId.get(restaurant.id) || 'staff',
          });
        });
      }

      const ownerFilters = [`owner_id.eq.${user.id}`];
      if (profileRow?.email) {
        ownerFilters.push(`email.eq.${profileRow.email}`);
      }

      const { data: ownedRestaurants } = await supabase
        .from('restaurants')
        .select('id, name')
        .or(ownerFilters.join(','))
        .order('name', { ascending: true });

      (ownedRestaurants || []).forEach((restaurant) => {
        restaurantMap.set(restaurant.id, {
          ...restaurant,
          access_level: 'owner',
        });
      });

      if (profileRow) setProfile(profileRow);
      setRestaurants(Array.from(restaurantMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'th')));
    };

    fetchRestaurantWorkspace();
  }, [supabase]);

  return (
    <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-800 p-4 md:p-6 flex flex-col justify-between shrink-0 h-auto md:min-h-[calc(100vh-68px)] relative">
      <div>
        <div className="flex items-center justify-between pb-3 md:pb-4 border-b border-neutral-800">
          <div>
            <h1 className="text-lg md:text-xl font-black text-orange-500 tracking-wide uppercase">
              Restaurant Workspace
            </h1>
            <p className="text-[10px] md:text-xs text-gray-500">ORDER MANAGEMENT</p>
          </div>

          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 text-xs font-bold text-gray-300 hover:text-white border border-neutral-700 active:scale-95 transition-all"
            aria-label="Toggle Restaurant Menu"
          >
            <span>{isMobileOpen ? 'ปิด' : 'เมนู'}</span>
          </button>
        </div>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out md:block ${
            isMobileOpen ? 'grid-rows-[1fr] opacity-100 pt-4' : 'grid-rows-[0fr] opacity-0 md:opacity-100 md:pt-4'
          }`}
        >
          <div className="overflow-hidden md:overflow-visible">
            <div className="mb-6 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
              <div className="flex items-center gap-3">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Restaurant User Avatar"
                    className="w-10 h-10 rounded-full border border-orange-500 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-sm font-black text-black shrink-0">
                    {(profile?.full_name || profile?.username || 'R')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white truncate">
                    {profile?.full_name || profile?.username || 'Restaurant'}
                  </p>
                  <span className="inline-block text-[9px] font-black px-1.5 py-0.2 bg-orange-500/20 text-orange-400 border border-orange-500/40 rounded uppercase tracking-wide mt-0.5">
                    ร้านค้า
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-orange-500/10 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">ร้านที่ดูแล</p>
                {restaurants.length > 0 ? (
                  restaurants.map((restaurant) => (
                    <p key={restaurant.id} className="truncate text-xs font-bold text-orange-300">
                      {restaurant.name}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-neutral-500">ยังไม่ได้รับสิทธิ์ร้าน</p>
                )}
              </div>
            </div>

            {restaurants
                .filter((restaurant) => restaurant.access_level === 'owner')
                .map((restaurant) => (
                  <Link
                    key={restaurant.id}
                    href={`/admin/restaurants/${restaurant.id}`}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-black transition-all active:scale-95 ${
                      pathname === `/admin/restaurants/${restaurant.id}`
                        ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <span>🏪</span>
                    <span className="min-w-0 truncate">จัดการข้อมูลร้าน</span>
                  </Link>
                ))}

            <nav className="space-y-2">
              <Link
                href="/admin/orders"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-black transition-all active:scale-95 ${
                  pathname === '/admin/orders'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span>🧾</span> รับออเดอร์
              </Link>

            
            </nav>

            <div className="mt-8 pt-4 border-t border-neutral-800">
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black text-red-400 bg-red-950/20 border border-red-900/30 hover:bg-red-950/45 hover:text-red-300 active:scale-95 transition-all shadow-md uppercase tracking-wider"
              >
                <span>🚪</span> ออกจากหน้าจัดการร้าน
              </Link>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
