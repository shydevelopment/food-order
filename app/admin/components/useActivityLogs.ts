import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export function useActivityLogs() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const parseSafeDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      const [
        { data: latestOrders },
        { data: latestUsers },
        { data: latestRestaurants },
        { data: latestMenus }
      ] = await Promise.all([
        supabase.from('orders').select('id, total_price, status, created_at').order('created_at', { ascending: false }).limit(25),
        supabase.from('profiles').select('id, full_name, username, role, email, created_at').order('created_at', { ascending: false }).limit(25),
        supabase.from('restaurants').select('id, name, created_at').order('created_at', { ascending: false }).limit(15),
        supabase.from('menus').select('id, name, price, created_at, restaurants(name), menu_categories(name)').order('created_at', { ascending: false }).limit(25)
      ]);

      const formattedOrders = (latestOrders || []).map((o) => ({
        id: `order-${o.id}`,
        type: 'order',
        title: `คำสั่งซื้อใหม่ #${String(o.id).substring(0, 8)}`,
        detail: `ยอดชำระ: ฿${o.total_price ? o.total_price.toLocaleString() : '0'} • สถานะ: ${o.status || 'รอดำเนินการ'}`,
        timestamp: parseSafeDate(o.created_at),
        icon: '🛒',
        colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      }));

      const formattedUsers = (latestUsers || []).map((u) => ({
        id: `user-${u.id}`,
        type: 'user',
        title: `สมาชิกในระบบ`,
        detail: `${u.full_name || u.username || 'สมาชิก'} (@${u.username || 'user'}) • บทบาท: ${u.role || 'customer'}`,
        timestamp: parseSafeDate(u.created_at),
        icon: '👤',
        colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      }));

      const formattedRestaurants = (latestRestaurants || []).map((r) => ({
        id: `rest-${r.id}`,
        type: 'restaurant',
        title: `เพิ่มร้านอาหารใหม่เข้าระบบ`,
        detail: `ร้าน "${r.name}" เปิดให้บริการในระบบแล้ว`,
        timestamp: parseSafeDate(r.created_at),
        icon: '🏪',
        colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      }));

      const formattedMenus = (latestMenus || []).map((m: any) => ({
        id: `menu-${m.id}`,
        type: 'menu',
        title: `เพิ่มเมนูอาหารใหม่`,
        detail: `เมนู "${m.name}" (฿${m.price ? m.price.toLocaleString() : '0'})`,
        timestamp: parseSafeDate(m.created_at),
        icon: '🍽️',
        colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      }));

      const combinedLogs = [...formattedOrders, ...formattedUsers, ...formattedRestaurants, ...formattedMenus]
        .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));

      setActivities(combinedLogs);
    } catch (error: any) {
      console.error('Error fetching activity logs:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  return { activities, loading, refetch: fetchActivityLogs };
}