// app/admin/layout.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { usePathname, useRouter } from 'next/navigation';
import AdminSidebar from './components/admin-sidebar';
import RestaurantSidebar from './components/restaurant-sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  useEffect(() => {
    const verifyAdmin = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profile, error: dbError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (dbError || !['admin', 'restaurant'].includes(profile?.role)) {
        router.replace('/'); 
        return;
      }

      const isRestaurantAllowedPage =
        pathname === '/admin/orders' ||
        pathname === '/admin/activity-logs' ||
        pathname.startsWith('/admin/restaurants/');

      if (profile.role === 'restaurant' && !isRestaurantAllowedPage) {
        router.replace('/admin/orders');
        return;
      }

      setRole(profile.role);
      setAuthorized(true);
      setLoading(false);
    };

    verifyAdmin();
  }, [pathname, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-gray-400 tracking-wide mt-2">
          กำลังตรวจสอบสิทธิ์...
        </p>
      </div>
    );
  }

  if (authorized) {
    return (
      /* 
        🛠️ จุดแก้ไข: ย้ายพวกคลาสเจาะทะลุกรอบและ calc ที่ Tailwind ฟ้องเตือนเส้นเหลือง 
        ลงมาเขียนไว้ที่ `style={{ ... }}` ด้านล่างนี้แทน ลินเตอร์ของ Tailwind จะไม่มองข้ามมาตรฐาน 
        และทำให้เส้นเหลืองหายไปทันที โดยไม่เสียโครงสร้าง UI เดิมครับ
      */
      <div 
        className="relative w-auto bg-black flex flex-col lg:flex-row items-stretch overflow-x-hidden m-0 p-0 -mx-3 -mt-4 -mb-4 sm:-mx-6 lg:-mx-8"
        style={{
          minHeight: 'calc(100vh - 44px)'
        }}
      >
        
        {role === 'admin' ? <AdminSidebar /> : <RestaurantSidebar />}

        {/* 📄 ส่วนแสดงเนื้อหาฝั่งขวา */}
        <main className="min-w-0 flex-1 bg-neutral-950 p-3 sm:p-5 lg:p-8 overflow-x-hidden lg:overflow-y-auto">
          {children}
        </main>

      </div>
    );
  }

  return null;
} 
