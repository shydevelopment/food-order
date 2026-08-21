'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export default function RestaurantDetailPage() {
  const params = useParams();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [accessLevel, setAccessLevel] = useState<'owner' | 'staff'>('staff');
  
  // State สำหรับคำนวณสถานะเปิดปิด Real-time
  const [isOpenNow, setIsOpenNow] = useState(false);
  
  // 🔥 State สำหรับระบบแก้ไขข้อมูลร้านอาหาร
  const [isEditRestModalOpen, setIsEditRestModalOpen] = useState(false);
  const [restImageFile, setRestImageFile] = useState<File | null>(null);
  const [editRestData, setEditRestData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    open_time: '',
    close_time: ''
  });

  // State สำหรับระบบจัดการเมนู
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newMenu, setNewMenu] = useState({
    name: '',
    price: '',
    description: '',
    is_available: true
  });

  // 👥 State สำหรับระบบดูสมาชิก / พนักงานประจำร้าน
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newStaffIdentifier, setNewStaffIdentifier] = useState('');

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  // ฟังก์ชันตรวจสอบสถานะร้านค้าจากเวลาจริง
  const checkStoreStatus = (openTime: string, closeTime: string) => {
    if (!openTime || !closeTime) return false;
    const now = new Date();
    const currentTimeStr = now.toTimeString().split(' ')[0]; 
    if (closeTime > openTime) {
      return currentTimeStr >= openTime && currentTimeStr <= closeTime;
    } else {
      return currentTimeStr >= openTime || currentTimeStr <= closeTime;
    }
  };

  const formatTimeDisplay = (timeStr: string) => {
    if (!timeStr) return '--:--';
    return timeStr.substring(0, 5);
  };

  const fetchRestaurantAndMenus = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถโหลดข้อมูลร้านอาหารได้');
      }

      const restaurantData = result.restaurant;
      
      if (restaurantData) {
        setRestaurant(restaurantData);
        const status = checkStoreStatus(restaurantData.open_time, restaurantData.close_time);
        setIsOpenNow(status);
      }

      setMenus(result.menus || []);
      setMembers(result.members || []);
      setCanManage(Boolean(result.canManage));
      setAccessLevel(result.accessLevel === 'owner' ? 'owner' : 'staff');
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      alert('ไม่สามารถโหลดข้อมูลร้านอาหารได้: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 👥 ฟังก์ชันดึงรายชื่อสมาชิก / เจ้าของ / พนักงานประจำร้านจากตาราง profiles
  const fetchRestaurantMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถโหลดสมาชิกในร้านได้');
      }

      setMembers(result.members || []);
      setCanManage(Boolean(result.canManage));
      setAccessLevel(result.accessLevel === 'owner' ? 'owner' : 'staff');
    } catch (err: any) {
      console.error('Error fetching members:', err.message);
      alert('ไม่สามารถโหลดสมาชิกในร้านได้: ' + err.message);
    } finally {
      setMembersLoading(false);
    }
  };

  const openMembersModal = () => {
    setIsMembersModalOpen(true);
    fetchRestaurantMembers();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRestaurantAndMenus();
  }, [restaurantId, supabase]);

  // ฟังก์ชันเปิด Modal แก้ไขข้อมูลร้าน
  const openEditRestModal = () => {
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขข้อมูลร้านได้');
    if (!restaurant) return;
    setEditRestData({
      name: restaurant.name || '',
      description: restaurant.description || '',
      address: restaurant.address || '',
      phone: restaurant.phone || '',
      email: restaurant.email || '',
      open_time: restaurant.open_time || '08:00:00',
      close_time: restaurant.close_time || '20:00:00'
    });
    setRestImageFile(null);
    setIsEditRestModalOpen(true);
  };

  // ฟังก์ชันบันทึกการแก้ไขข้อมูลร้านอาหาร
  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRestData.name) return alert('กรุณากรอกชื่อร้านอาหาร');

    setActionLoading(true);
    let uploadedImageUrl = restaurant.image_url;

    try {
      if (restImageFile) {
        const fileExt = restImageFile.name.split('.').pop();
        const fileName = `logos/${restaurantId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, restImageFile, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('menu-images')
          .getPublicUrl(fileName);

        uploadedImageUrl = publicUrl;
      }

      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editRestData.name,
          description: editRestData.description || null,
          address: editRestData.address || null,
          phone: editRestData.phone || null,
          email: editRestData.email || null,
          open_time: editRestData.open_time,
          close_time: editRestData.close_time,
          image_url: uploadedImageUrl
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถแก้ไขร้านค้าได้');

      if (result.restaurant) {
        setRestaurant(result.restaurant);
        const status = checkStoreStatus(result.restaurant.open_time, result.restaurant.close_time);
        setIsOpenNow(status);
      }
      
      setIsEditRestModalOpen(false);
      alert('แก้ไขข้อมูลร้านค้าสำเร็จ 🎉');
    } catch (error: any) {
      alert('เกิดข้อผิดพลาดในการแก้ไขร้านค้า: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ฟังก์ชันจัดการเพิ่มเมนูอาหาร
  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่เพิ่มเมนูได้');
    if (!newMenu.name || !newMenu.price) return alert('กรุณากรอกชื่อเมนูและราคา');

    setActionLoading(true);
    let uploadedImageUrl = null;

    try {
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `menus/${restaurantId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, imageFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('menu-images')
          .getPublicUrl(fileName);

        uploadedImageUrl = publicUrl;
      }

      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'menu',
          name: newMenu.name,
          price: parseFloat(newMenu.price),
          description: newMenu.description || null,
          image_url: uploadedImageUrl,
          is_available: newMenu.is_available
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถเพิ่มเมนูได้');

      if (result.menu) setMenus([result.menu, ...menus]);
      setNewMenu({ name: '', price: '', description: '', is_available: true });
      setImageFile(null);
      setIsModalOpen(false);
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ฟังก์ชันลบเมนูอาหาร
  const handleDeleteMenu = async (menuId: string, menuName: string) => {
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่ลบเมนูได้');
    if (!confirm(`คุณต้องการลบเมนู "${menuName}" ใช่หรือไม่?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'menu', menuId }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถลบเมนูได้');

      setMenus(menus.filter((menu) => menu.id !== menuId));
    } catch (error: any) {
      alert('ไม่สามารถลบเมนูได้: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่เพิ่มลูกน้องได้');
    if (!newStaffIdentifier.trim()) return alert('กรุณากรอก username ของลูกน้อง');

    setMembersLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'member',
          identifier: newStaffIdentifier.trim(),
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถเพิ่มลูกน้องได้');

      setNewStaffIdentifier('');
      await fetchRestaurantMembers();
      alert('เพิ่มลูกน้องเข้าร้านสำเร็จ');
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleRemoveStaff = async (member: any) => {
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่ลบลูกน้องได้');
    if (member.access_level === 'owner') return alert('ไม่สามารถลบเจ้าของร้านจากหน้านี้ได้');

    const displayName = member.full_name || member.username || member.email || 'ลูกน้องคนนี้';
    if (!confirm(`ต้องการลบ ${displayName} ออกจากร้านใช่ไหม?`)) return;

    setMembersLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'member',
          memberId: member.member_id,
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถลบลูกน้องได้');

      await fetchRestaurantMembers();
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setMembersLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-neutral-400 bg-neutral-950 min-h-screen">กำลังโหลดข้อมูลระบบร้านอาหาร...</div>;
  if (!restaurant) return <div className="p-8 text-red-400 bg-neutral-950 min-h-screen">⚠️ ไม่พบข้อมูลร้านอาหาร</div>;

  return (
    <div className="p-6 md:p-10 bg-neutral-950 min-h-screen text-white relative">
      
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/orders" className="text-xs font-bold text-neutral-500 hover:text-orange-500 transition-colors uppercase tracking-wider">
          ← กลับไปหน้ารับออเดอร์
        </Link>
      </div>

      {/* 🏪 ส่วนแสดงข้อมูลร้าน */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 shadow-xl relative group">
        
        {/* 🔥 ปุ่มสำหรับแก้ไขข้อมูลร้านอาหาร & ปุ่มดูสมาชิกประจำร้าน */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide ${
            accessLevel === 'owner'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
          }`}>
            {accessLevel === 'owner' ? 'OWNER' : 'STAFF'}
          </span>
          {/* 👥 ปุ่มเปิดดูรายชื่อสมาชิกในร้าน */}
          <button 
            onClick={openMembersModal}
            className="bg-orange-500 hover:bg-orange-600 text-black px-3.5 py-1.5 rounded-lg text-xs font-black transition-all shadow-lg shadow-orange-500/10 flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            👥 สมาชิกในร้าน
          </button>

          {canManage && (
            <button 
              onClick={openEditRestModal}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-neutral-700/60 flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              ✏️ แก้ไขข้อมูลร้าน
            </button>
          )}
        </div>

        {restaurant.image_url ? (
          <img src={restaurant.image_url} alt={restaurant.name} className="w-44 h-44 object-cover rounded-xl border border-neutral-800 shadow-md shrink-0 bg-neutral-950" />
        ) : (
          <div className="w-44 h-44 bg-neutral-950 rounded-xl flex items-center justify-center border border-neutral-800 text-neutral-600 shrink-0">🏪 No Image</div>
        )}
        <div className="flex-1 w-full pr-0 md:pr-48">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl font-black text-white">{restaurant.name}</h1>
            <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider border ${
              isOpenNow ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {isOpenNow ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
          <p className="text-sm text-neutral-400 mb-4">{restaurant.description || 'ไม่มีคำอธิบายร้าน'}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4 border-t border-neutral-800/60 text-xs text-neutral-400">
            <p>📍 <strong>ที่อยู่:</strong> {restaurant.address || '-'}</p>
            <p>📞 <strong>เบอร์โทร:</strong> {restaurant.phone || '-'}</p>
            {restaurant.email && <p>📧 <strong>อีเมล:</strong> {restaurant.email}</p>}
            <p className="sm:col-span-2 text-orange-400 font-bold">
              🕒 เวลาทำการ: {formatTimeDisplay(restaurant.open_time)} - {formatTimeDisplay(restaurant.close_time)} น.
            </p>
          </div>
        </div>
      </div>

      {/* 🍽️ ส่วนจัดการเมนูอาหาร */}
      <div>
        <div className="flex justify-between items-center mb-6 border-b border-neutral-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-orange-500 uppercase tracking-wide">Menu Management</h2>
            <p className="text-xs text-neutral-500 mt-0.5">รายการอาหารเฉพาะของร้านนี้ ({menus.length})</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={openMembersModal}
              className="bg-neutral-800 hover:bg-neutral-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all border border-neutral-700 cursor-pointer"
            >
              👥 ดูสมาชิกในร้าน
            </button>
            {canManage && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-orange-500/10 cursor-pointer"
              >
                + เพิ่มเมนูใหม่
              </button>
            )}
          </div>
        </div>

        {menus.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {menus.map((menu) => (
              <div key={menu.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex gap-4 hover:border-neutral-700 transition-all relative group shadow-md">
                {canManage && (
                  <button 
                    disabled={actionLoading}
                    onClick={() => handleDeleteMenu(menu.id, menu.name)}
                    className="absolute top-3 right-3 text-neutral-500 hover:text-red-400 p-1.5 rounded-md hover:bg-red-950/30 transition-all duration-200 opacity-80 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    🗑️
                  </button>
                )}
                {menu.image_url ? (
                  <img src={menu.image_url} alt={menu.name} className="w-20 h-20 rounded-lg object-cover bg-neutral-950 border border-neutral-800/80 shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-neutral-950 flex items-center justify-center text-[10px] text-neutral-600 font-bold border border-neutral-800 shrink-0">🍽️ NO PIC</div>
                )}
                <div className="flex flex-col justify-between flex-1 min-w-0 pr-6">
                  <div>
                    <h3 className="font-bold text-white text-sm truncate">{menu.name}</h3>
                    <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{menu.description || 'ไม่มีรายละเอียด'}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/40">
                    <span className="text-orange-500 font-black text-sm">฿{Number(menu.price).toLocaleString()}</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${menu.is_available ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                      {menu.is_available ? 'พร้อมขาย' : 'ของหมด'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-900/40 border border-neutral-800 border-dashed rounded-2xl p-16 text-center">
            <span className="text-4xl block mb-3">🍽️</span>
            <h4 className="text-sm font-bold text-neutral-400">ยังไม่มีเมนูอาหารในร้านนี้</h4>
          </div>
        )}
      </div>

      {/* 👥 POPUP MODAL: รายชื่อสมาชิก / เจ้าของ / พนักงานในร้าน */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center pb-4 border-b border-neutral-800 shrink-0">
              <div>
                <h3 className="text-lg font-black text-orange-500 uppercase tracking-wide flex items-center gap-2">
                  👥 รายชื่อสมาชิกประจำร้าน (Restaurant Staff / Members)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">ร้าน {restaurant?.name}</p>
              </div>
              <button 
                onClick={() => setIsMembersModalOpen(false)} 
                className="text-neutral-500 hover:text-white text-lg font-bold w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {canManage && (
              <form onSubmit={handleAddStaff} className="mt-4 rounded-xl border border-orange-500/15 bg-orange-500/5 p-4">
                <label className="block text-xs font-black uppercase tracking-wide text-orange-400">
                  เพิ่มลูกน้องเข้าร้าน
                </label>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    value={newStaffIdentifier}
                    onChange={(e) => setNewStaffIdentifier(e.target.value)}
                    placeholder="กรอก username ของผู้ใช้ role restaurant"
                    className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={membersLoading || !newStaffIdentifier.trim()}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-black text-black transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                  >
                    เพิ่มลูกน้อง
                  </button>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  ต้องกรอก username เท่านั้น และผู้ใช้ต้องมี role เป็น restaurant หรือ admin
                </p>
              </form>
            )}

            {/* Member Cards List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 custom-scrollbar">
              {membersLoading ? (
                <div className="py-16 text-center text-sm text-orange-500 animate-pulse font-bold">
                  กำลังโหลดข้อมูลสมาชิกในร้าน...
                </div>
              ) : members.length > 0 ? (
                members.map((member) => {
                  const isOwner = restaurant.owner_id === member.id || member.access_level === 'owner';
                  const displayName = member.full_name || member.username || 'สมาชิกประจำร้าน';

                  return (
                    <div 
                      key={member.id} 
                      className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between gap-4 hover:border-neutral-700 transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="avatar" className="w-12 h-12 rounded-full object-cover border border-orange-500/40 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-black font-black text-base shrink-0">
                            {displayName[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-bold text-white truncate">{displayName}</p>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide border ${
                              isOwner 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}>
                              {isOwner ? '👑 เจ้าของร้าน (Owner)' : `👤 ${member.access_level === 'staff' ? 'พนักงานร้าน' : member.role || 'พนักงาน'}`}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">Username: @{member.username || '-'}</p>
                          <p className="text-xs text-neutral-500 truncate">📧 อีเมล: {member.email || '-'}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono text-neutral-400 block">
                          📞 {member.phone || 'ไม่ระบุเบอร์โทร'}
                        </span>
                        {canManage && !isOwner && member.member_id && (
                          <button
                            type="button"
                            disabled={membersLoading}
                            onClick={() => handleRemoveStaff(member)}
                            className="mt-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                          >
                            ลบออก
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center text-sm text-neutral-500 italic">
                  ยังไม่ได้ผูกข้อมูลสมาชิกประจำร้านในระบบ
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="pt-4 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-500 shrink-0">
              <span>จำนวนสมาชิกทั้งหมด {members.length} คน</span>
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ✏️ POPUP MODAL: แก้ไขข้อมูลร้านอาหาร */}
      {isEditRestModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-800">
              <h3 className="text-base font-black text-orange-500 uppercase tracking-wide">✏️ แก้ไขข้อมูลร้านอาหาร</h3>
              <button onClick={() => setIsEditRestModalOpen(false)} className="text-neutral-500 hover:text-white text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleUpdateRestaurant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">ชื่อร้านอาหาร *</label>
                <input type="text" required value={editRestData.name} onChange={(e) => setEditRestData({...editRestData, name: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1">เบอร์โทรศัพท์</label>
                  <input type="text" value={editRestData.phone} onChange={(e) => setEditRestData({...editRestData, phone: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1">อีเมลร้านค้า</label>
                  <input type="email" value={editRestData.email} onChange={(e) => setEditRestData({...editRestData, email: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1">เวลาเปิดบริการ</label>
                  <input type="time" step="1" required value={editRestData.open_time} onChange={(e) => setEditRestData({...editRestData, open_time: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1">เวลาปิดบริการ</label>
                  <input type="time" step="1" required value={editRestData.close_time} onChange={(e) => setEditRestData({...editRestData, close_time: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">รูปภาพหน้าร้าน (อัปโหลดรูปใหม่)</label>
                <input type="file" accept="image/*" onChange={(e) => e.target.files && setRestImageFile(e.target.files[0])} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 cursor-pointer" />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">คำอธิบายร้านอาหาร</label>
                <textarea rows={2} value={editRestData.description} onChange={(e) => setEditRestData({...editRestData, description: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">ที่อยู่ร้านอาหาร</label>
                <textarea rows={2} value={editRestData.address} onChange={(e) => setEditRestData({...editRestData, address: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-neutral-800 mt-4">
                <button type="button" onClick={() => setIsEditRestModalOpen(false)} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-2 rounded-lg text-xs font-bold">ยกเลิก</button>
                <button type="submit" disabled={actionLoading} className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider">
                  {actionLoading ? 'กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✨ POPUP MODAL: เพิ่มเมนูอาหาร */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-800">
              <h3 className="text-base font-black text-orange-500 uppercase tracking-wide">✨ เพิ่มเมนูอาหารใหม่</h3>
              <button onClick={() => { setIsModalOpen(false); setImageFile(null); }} className="text-neutral-500 hover:text-white text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleAddMenu} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">ชื่อเมนูอาหาร *</label>
                <input type="text" required placeholder="เช่น ข้าวกะเพราหมูกรอบไข่ดาว" value={newMenu.name} onChange={(e) => setNewMenu({...newMenu, name: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1">ราคา (บาท) *</label>
                  <input type="number" required min="0" step="0.01" placeholder="50" value={newMenu.price} onChange={(e) => setNewMenu({...newMenu, price: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1">สถานะเริ่มต้น</label>
                  <select value={newMenu.is_available ? 'true' : 'false'} onChange={(e) => setNewMenu({...newMenu, is_available: e.target.value === 'true'})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                    <option value="true">พร้อมขาย (มีของ)</option>
                    <option value="false">ของหมด (ปิดชั่วคราว)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">รูปภาพเมนูอาหาร</label>
                <input type="file" accept="image/*" onChange={(e) => e.target.files && setImageFile(e.target.files[0])} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">รายละเอียดเมนูย่อย</label>
                <textarea rows={2} placeholder="คำอธิบายสั้นๆ..." value={newMenu.description} onChange={(e) => setNewMenu({...newMenu, description: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-neutral-800 mt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setImageFile(null); }} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-2 rounded-lg text-xs font-bold">ยกเลิก</button>
                <button type="submit" disabled={actionLoading} className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider disabled:bg-neutral-700 disabled:text-neutral-500">
                  {actionLoading ? 'กำลังอัปโหลด...' : '💾 บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
