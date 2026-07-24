// app/admin/layout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Sidebar from './components/sidebar'; // อิมพอร์ต Sidebar Component

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

      if (dbError || profile?.role !== 'admin') {
        router.replace('/'); 
        return;
      }

      setAuthorized(true);
      setLoading(false);
    };

    verifyAdmin();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-gray-400 tracking-wide mt-2">
          กำลังตรวจสอบสิทธิ์ Admin...
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
        className="relative w-screen bg-black flex flex-col md:flex-row items-stretch md:overflow-hidden overflow-x-hidden m-0 p-0 -mt-6 -mb-6"
        style={{
          left: '50%',
          right: '50%',
          marginLeft: '-50vw',
          marginRight: '-50vw',
          minHeight: 'calc(100vh - 44px)'
        }}
      >
        
        {/* 🧱 แทรก Sidebar ไว้ฝั่งซ้าย */}
        <Sidebar />

        {/* 📄 ส่วนแสดงเนื้อหาฝั่งขวา */}
        <main className="flex-1 p-6 md:p-10 bg-neutral-950 overflow-y-auto h-full">
          {children}
        </main>

      </div>
    );
  }

  return null;
} 