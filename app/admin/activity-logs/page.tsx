'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminActivityLogsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // ⚡ ตัวกรองประเภทกิจกรรม
  const [filterType, setFilterType] = useState<'all' | 'order' | 'user' | 'restaurant' | 'menu'>('all');

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      // 1. ดึงข้อมูลออร์เดอร์ย้อนหลัง 25 รายการล่าสุด
      const { data: latestOrders } = await supabase
        .from('orders')
        .select('id, total_price, status, created_at')
        .order('created_at', { ascending: false })
        .limit(25);

      // 2. 👤 ดึงข้อมูลสมาชิกจากตาราง profiles (ใช้คอลัมน์จริงที่มีตามสกีมา)
      const { data: latestUsers } = await supabase
        .from('profiles')
        .select('id, full_name, username, role, email')
        .limit(25);

      // 3. ดึงข้อมูลร้านค้าใหม่ย้อนหลัง 15 รายการล่าสุด
      const { data: latestRestaurants } = await supabase
        .from('restaurants')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(15);

      // 4. 🍽️ ดึงข้อมูลเมนูอาหารใหม่ย้อนหลัง 25 รายการล่าสุด
      const { data: latestMenus } = await supabase
        .from('menus')
        .select('id, name, price, created_at, restaurants(name), menu_categories(name)')
        .order('created_at', { ascending: false })
        .limit(25);

      // แปลงข้อมูลให้อยู่ในฟอร์แมต Activity
      const formattedOrders = (latestOrders || []).map((o) => ({
        id: `order-${o.id}`,
        type: 'order',
        title: `คำสั่งซื้อใหม่ #${String(o.id).substring(0, 8)}`,
        detail: `ยอดชำระ: ฿${o.total_price ? o.total_price.toLocaleString() : '0'} • สถานะ: ${o.status || 'รอดำเนินการ'}`,
        timestamp: new Date(o.created_at),
        icon: '🛒',
        colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      }));

      // 👤 จัดฟอร์แมตข้อมูลสมาชิกจาก profiles
      const formattedUsers = (latestUsers || []).map((u) => ({
        id: `user-${u.id}`,
        type: 'user',
        title: `สมาชิกในระบบ`,
        detail: `${u.full_name || u.username || 'สมาชิก'} (@${u.username || 'user'}) • บทบาท: ${u.role || 'customer'} • อีเมล: ${u.email || '-'}`,
        timestamp: new Date(), // เนื่องจากตาราง profiles ไม่มี created_at
        icon: '👤',
        colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      }));

      const formattedRestaurants = (latestRestaurants || []).map((r) => ({
        id: `rest-${r.id}`,
        type: 'restaurant',
        title: `เพิ่มร้านอาหารใหม่เข้าระบบ`,
        detail: `ร้าน "${r.name}" เปิดให้บริการในระบบแล้ว`,
        timestamp: new Date(r.created_at),
        icon: '🏪',
        colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      }));

      const formattedMenus = (latestMenus || []).map((m: any) => {
        const catName = m.menu_categories?.name ? ` [${m.menu_categories.name}]` : '';
        const restName = m.restaurants?.name ? ` จากร้าน ${m.restaurants.name}` : '';

        return {
          id: `menu-${m.id}`,
          type: 'menu',
          title: `เพิ่มเมนูอาหารใหม่`,
          detail: `เมนู "${m.name}" (฿${m.price ? m.price.toLocaleString() : '0'})${catName}${restName}`,
          timestamp: new Date(m.created_at),
          icon: '🍽️',
          colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
        };
      });

      // รวมและเรียงตามเวลาจากล่าสุดไปเก่าสุด
      const combinedLogs = [...formattedOrders, ...formattedUsers, ...formattedRestaurants, ...formattedMenus]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setActivities(combinedLogs);
    } catch (error: any) {
      console.error('Error fetching activity logs:', error.message);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'เมื่อสักครู่';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  };

  // กรองตามคำค้นหา และ ประเภทกิจกรรม
  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      act.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.detail.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || act.type === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="relative p-2 space-y-6">
      {/* ส่วนหัวของหน้าจอ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-wide">
            📜 ประวัติกิจกรรมทั้งหมด (Activity Logs)
          </h2>
          <p className="text-base text-gray-300 mt-1.5">
            บันทึกการทำรายการ สมาชิก ร้านอาหาร เมนูอาหาร และกิจกรรมในระบบ
          </p>
        </div>

        <button
          type="button"
          onClick={fetchActivityLogs}
          className="self-start md:self-auto bg-orange-500 hover:bg-orange-600 text-black px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-orange-500/10 flex items-center gap-2 active:scale-95 cursor-pointer"
        >
          <span>🔄</span> รีเฟรชประวัติ
        </button>
      </div>

      {/* แถบค้นหาและปุ่มกรองประเภท */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* ช่องค้นหา */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="ค้นหากิจกรรม, สมาชิก, ออร์เดอร์, ชื่อร้าน หรือเมนู..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-550 transition-colors"
          />
        </div>

        {/* ปุ่มกรองประเภท */}
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-orange-500 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ทั้งหมด ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('order')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'order'
                ? 'bg-emerald-500 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🛒 ออร์เดอร์
          </button>
          <button
            type="button"
            onClick={() => setFilterType('user')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'user'
                ? 'bg-blue-500 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            👤 สมาชิก
          </button>
          <button
            type="button"
            onClick={() => setFilterType('restaurant')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'restaurant'
                ? 'bg-orange-400 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏪 ร้านค้า
          </button>
          <button
            type="button"
            onClick={() => setFilterType('menu')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'menu'
                ? 'bg-purple-500 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🍽️ เมนูอาหาร
          </button>
        </div>
      </div>

      {/* รายการ Activity Logs */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl">
        {loading ? (
          <div className="py-20 text-center text-sm text-orange-500 animate-pulse font-bold">
            กำลังโหลดประวัติกิจกรรมทั้งหมด...
          </div>
        ) : filteredActivities.length > 0 ? (
          <div className="space-y-3">
            {filteredActivities.map((act) => (
              <div
                key={act.id}
                className="p-4 bg-neutral-950/70 border border-neutral-800/80 rounded-xl flex items-center justify-between gap-4 hover:bg-neutral-800/40 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border shrink-0 ${act.colorClass}`}>
                    {act.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-white truncate">
                      {act.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {act.detail}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-orange-400 font-bold font-mono">
                    {formatTimeAgo(act.timestamp)}
                  </span>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">
                    {act.timestamp.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} {act.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-sm text-neutral-500 italic">
            ไม่พบประวัติกิจกรรมที่ตรงกับเงื่อนไขการค้นหา
          </div>
        )}
      </div>
    </div>
  );
}