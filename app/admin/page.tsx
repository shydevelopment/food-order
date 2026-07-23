'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ActivityLogItem } from './components/ActivityLogItem';

export default function AdminDashboardHome() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // State สำหรับสถิติ
  const [userCount, setUserCount] = useState<number>(0);
  const [restaurantCount, setRestaurantCount] = useState<number>(0);
  const [todayOrdersCount, setTodayOrdersCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // State สำหรับ Activity Log
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);

  useEffect(() => {
    fetchDashboardStats();
    fetchActivityLogs();

    // ⚡ ดักจับ Realtime เมื่อมีการสร้างข้อมูลใหม่
    const channel = supabase
      .channel('realtime-dashboard-activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => handleRealtimeUpdate())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'restaurants' }, () => handleRealtimeUpdate())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menus' }, () => handleRealtimeUpdate())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => handleRealtimeUpdate())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleRealtimeUpdate = () => {
    fetchDashboardStats();
    fetchActivityLogs();
  };

  // Helper แปลงเป็น Date Object อย่างปลอดภัย
  const parseSafeDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // 1. ดึงข้อมูลสถิติรวม
  const fetchDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const { count: uCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: rCount } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true });

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { count: oCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfToday.toISOString());

      setUserCount(uCount || 0);
      setRestaurantCount(rCount || 0);
      setTodayOrdersCount(oCount || 0);
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error.message);
    } finally {
      setLoadingStats(false);
    }
  };

  // 2. ดึงข้อมูลกิจกรรมล่าสุด (ดึง created_at จริงจาก Supabase)
  const fetchActivityLogs = async () => {
    setLoadingActivities(true);
    try {
      // ดึง 5 ออร์เดอร์ล่าสุด
      const { data: latestOrders } = await supabase
        .from('orders')
        .select('id, total_price, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      // ⚡ ดึง 5 สมาชิกสิริรวมเรียงตาม created_at จริง
      const { data: latestUsers } = await supabase
        .from('profiles')
        .select('id, full_name, username, role, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      // ดึง 3 ร้านค้าล่าสุด
      const { data: latestRestaurants } = await supabase
        .from('restaurants')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      // ดึง 5 เมนูอาหารล่าสุด
      const { data: latestMenus } = await supabase
        .from('menus')
        .select('id, name, price, created_at, restaurants(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      // จัดฟอร์แมตข้อมูลกิจกรรม
      const formattedOrders = (latestOrders || []).map((o) => ({
        id: `order-${o.id}`,
        title: `มีรายการสั่งซื้อใหม่ #${String(o.id).substring(0, 8)}`,
        detail: `ยอดชำระ: ฿${o.total_price ? o.total_price.toLocaleString() : '0'} • สถานะ: ${o.status || 'รอดำเนินการ'}`,
        timestamp: parseSafeDate(o.created_at),
        icon: '🛒',
        colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      }));

      const formattedUsers = (latestUsers || []).map((u) => ({
        id: `user-${u.id}`,
        title: `ผู้ใช้งานในระบบ`,
        detail: `${u.full_name || u.username || 'สมาชิก'} (@${u.username || 'user'}) • บทบาท: ${u.role || 'customer'}`,
        timestamp: parseSafeDate(u.created_at), // ⚡ ดึงวันที่สมัครจริง
        icon: '👤',
        colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      }));

      const formattedRestaurants = (latestRestaurants || []).map((r) => ({
        id: `rest-${r.id}`,
        title: `เพิ่มร้านอาหารใหม่`,
        detail: `ร้าน "${r.name}" เข้าสู่ระบบ`,
        timestamp: parseSafeDate(r.created_at),
        icon: '🏪',
        colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      }));

      const formattedMenus = (latestMenus || []).map((m: any) => ({
        id: `menu-${m.id}`,
        title: `เพิ่มเมนูอาหารใหม่`,
        detail: `เมนู "${m.name}" (฿${m.price || 0}) ${m.restaurants?.name ? `ร้าน ${m.restaurants.name}` : ''}`,
        timestamp: parseSafeDate(m.created_at),
        icon: '🍽️',
        colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      }));

      // รวมและเรียงลำดับจากใหม่ไปเก่า
      const combinedLogs = [...formattedOrders, ...formattedUsers, ...formattedRestaurants, ...formattedMenus]
        .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
        .slice(0, 10);

      setActivities(combinedLogs);
    } catch (error: any) {
      console.error('Error fetching activity logs:', error.message);
    } finally {
      setLoadingActivities(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ส่วนหัวของหน้าจอ */}
      <div>
        <h2 className="text-2xl font-black text-white uppercase tracking-wide">
          📊 ภาพรวมระบบ (Dashboard)
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          ยินดีต้อนรับเข้าสู่ระบบจัดการ Food Order KMUTNB
        </p>
      </div>

      {/* การ์ดสรุปข้อมูลเด่นๆ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-xl">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">ผู้ใช้งานในระบบทั้งหมด</div>
          <div className="text-3xl font-black text-white mt-2">
            {loadingStats ? (
              <span className="text-sm text-orange-500 animate-pulse font-normal">กำลังโหลด...</span>
            ) : (
              <>
                {userCount.toLocaleString()} <span className="text-sm font-normal text-gray-400">คน</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-xl">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">ร้านอาหารพาร์ทเนอร์</div>
          <div className="text-3xl font-black text-orange-500 mt-2">
            {loadingStats ? (
              <span className="text-sm text-orange-500 animate-pulse font-normal">กำลังโหลด...</span>
            ) : (
              <>
                {restaurantCount.toLocaleString()} <span className="text-sm font-normal text-gray-400">ร้าน</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-xl">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">ออร์เดอร์วันนี้</div>
          <div className="text-3xl font-black text-emerald-400 mt-2">
            {loadingStats ? (
              <span className="text-sm text-orange-500 animate-pulse font-normal">กำลังโหลด...</span>
            ) : (
              <>
                {todayOrdersCount.toLocaleString()} <span className="text-sm font-normal text-gray-400">รายการ</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 📜 ส่วนแสดง Activity Log */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                📜 ประวัติกิจกรรมล่าสุด (Activity Log)
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isRealtimeActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-neutral-800 text-gray-400 border-neutral-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeActive ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
                {isRealtimeActive ? 'Real-time Live' : 'Connecting...'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              ติดตามเหตุการณ์และกิจกรรมสำคัญภายในระบบแบบ Real-time
            </p>
          </div>

          <button
            type="button"
            onClick={handleRealtimeUpdate}
            className="text-xs text-orange-400 hover:text-orange-300 font-bold bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            🔄 รีเฟรช
          </button>
        </div>

        {loadingActivities ? (
          <div className="py-12 text-center text-sm text-orange-500 animate-pulse font-bold">
            กำลังโหลดประวัติกิจกรรม...
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((act) => (
              <ActivityLogItem key={act.id} act={act} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-neutral-500 italic">
            ยังไม่มีประวัติกิจกรรมในระบบ
          </div>
        )}
      </div>
    </div>
  );
}