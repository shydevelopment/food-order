'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  COMMON_INGREDIENTS,
  DEFAULT_RESTAURANT_TYPE,
  getRestaurantTypeMeta,
  RESTAURANT_TYPES,
  supportsIngredientAvailability,
} from '@/lib/restaurant-types';
import { formatThaiPhoneInput } from '@/lib/phone';
import { ALL_WEEKDAY_VALUES, formatAvailableDays, getBangkokDayIndex, getWeekdayToneClasses, WEEKDAY_OPTIONS } from '@/lib/menu-days';
import { getMenuCategorySuggestions, getMenuCategoryToneClasses } from '@/lib/menu-categories';

export default function RestaurantDetailPage() {
  const params = useParams();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
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
    close_time: '',
    restaurant_type: DEFAULT_RESTAURANT_TYPE,
    unavailable_ingredients: [] as string[],
  });

  // State สำหรับระบบจัดการเมนู
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newMenu, setNewMenu] = useState<{
    name: string;
    price: string;
    description: string;
    is_available: boolean;
    available_days: number[];
    category_id: string;
  }>({
    name: '',
    price: '',
    description: '',
    is_available: true,
    available_days: ALL_WEEKDAY_VALUES,
    category_id: '',
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  // 👥 State สำหรับระบบดูสมาชิก / พนักงานประจำร้าน
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newStaffIdentifier, setNewStaffIdentifier] = useState('');

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
      setCategories(result.categories || []);
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
  }, [restaurantId]);

  const uploadWorkspaceImage = async (file: File, folder: 'restaurant-logos' | 'menus') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const res = await fetch(`/api/restaurant-workspace/${restaurantId}/uploads`, {
      method: 'POST',
      body: formData,
    });
    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'ไม่สามารถอัปโหลดรูปภาพได้');
    }

    return result.publicUrl as string;
  };

  // ฟังก์ชันเปิด Modal แก้ไขข้อมูลร้าน
  const openEditRestModal = () => {
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขข้อมูลร้านได้');
    if (!restaurant) return;
    setEditRestData({
      name: restaurant.name || '',
      description: restaurant.description || '',
      address: restaurant.address || '',
      phone: formatThaiPhoneInput(restaurant.phone || ''),
      email: restaurant.email || '',
      open_time: restaurant.open_time || '08:00:00',
      close_time: restaurant.close_time || '20:00:00',
      restaurant_type: restaurant.restaurant_type || DEFAULT_RESTAURANT_TYPE,
      unavailable_ingredients: restaurant.unavailable_ingredients || [],
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
        uploadedImageUrl = await uploadWorkspaceImage(restImageFile, 'restaurant-logos');
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
          image_url: uploadedImageUrl,
          restaurant_type: editRestData.restaurant_type,
          unavailable_ingredients: editRestData.unavailable_ingredients,
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

  const toggleUnavailableIngredient = (ingredient: string) => {
    setEditRestData((current) => {
      const exists = current.unavailable_ingredients.includes(ingredient);
      return {
        ...current,
        unavailable_ingredients: exists
          ? current.unavailable_ingredients.filter((item) => item !== ingredient)
          : [...current.unavailable_ingredients, ingredient],
      };
    });
  };

  const handleToggleIngredientAvailability = async (ingredient: string) => {
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่ปรับวัตถุดิบหมดได้');

    const currentIngredients = restaurant.unavailable_ingredients || [];
    const exists = currentIngredients.includes(ingredient);
    const nextIngredients = exists
      ? currentIngredients.filter((item: string) => item !== ingredient)
      : [...currentIngredients, ingredient];

    setActionLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: restaurant.name,
          description: restaurant.description || null,
          address: restaurant.address || null,
          phone: restaurant.phone || null,
          email: restaurant.email || null,
          open_time: restaurant.open_time,
          close_time: restaurant.close_time,
          image_url: restaurant.image_url || null,
          restaurant_type: restaurant.restaurant_type || DEFAULT_RESTAURANT_TYPE,
          unavailable_ingredients: nextIngredients,
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถอัปเดตวัตถุดิบได้');

      if (result.restaurant) {
        setRestaurant(result.restaurant);
      } else {
        setRestaurant({ ...restaurant, unavailable_ingredients: nextIngredients });
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
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
        uploadedImageUrl = await uploadWorkspaceImage(imageFile, 'menus');
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
          is_available: newMenu.is_available,
          available_days: newMenu.available_days,
          category_id: newMenu.category_id || null,
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถเพิ่มเมนูได้');

      if (result.menu) setMenus([result.menu, ...menus]);
      setNewMenu({ name: '', price: '', description: '', is_available: true, available_days: ALL_WEEKDAY_VALUES, category_id: '' });
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

  const handleToggleMenuAvailability = async (menu: any) => {
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่ปรับสถานะเมนูได้');

    setActionLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'menu_availability',
          menuId: menu.id,
          is_available: !menu.is_available,
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถปรับสถานะเมนูได้');

      setMenus((current) => current.map((item) => (
        item.id === menu.id ? { ...item, is_available: !menu.is_available } : item
      )));
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCategory = async (categoryName?: string) => {
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่เพิ่ม tag เมนูได้');

    const name = String(categoryName || newCategoryName).trim();
    if (!name) return alert('กรุณากรอกชื่อ tag เมนู');

    setActionLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'menu_category',
          name,
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถเพิ่ม tag เมนูได้');

      if (result.category) {
        setCategories((current) => {
          const exists = current.some((category) => category.id === result.category.id);
          const nextCategories = exists
            ? current.map((category) => category.id === result.category.id ? result.category : category)
            : [...current, result.category];

          return nextCategories.sort((a, b) => String(a.name).localeCompare(String(b.name), 'th'));
        });
        setNewMenu((current) => ({ ...current, category_id: result.category.id }));
      }

      setNewCategoryName('');
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleMenuDailyAvailability = async (menu: any, dayValue: number) => {
    if (!canManage) return alert('เฉพาะเจ้าของร้านเท่านั้นที่จัดการอาหารรายวันได้');

    const currentDays = Array.isArray(menu.available_days) ? menu.available_days : ALL_WEEKDAY_VALUES;
    const nextDays = currentDays.includes(dayValue)
      ? currentDays.filter((day: number) => day !== dayValue)
      : [...currentDays, dayValue].sort((a: number, b: number) => a - b);

    setActionLoading(true);
    try {
      const res = await fetch(`/api/restaurant-workspace/${restaurantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'menu_daily_availability',
          menuId: menu.id,
          available_days: nextDays,
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถจัดการอาหารรายวันได้');

      setMenus((current) => current.map((item) => (
        item.id === menu.id ? { ...item, available_days: result.menu?.available_days || nextDays } : item
      )));
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleNewMenuDay = (dayValue: number) => {
    setNewMenu((current) => {
      const exists = current.available_days.includes(dayValue);
      const nextDays = exists
        ? current.available_days.filter((day) => day !== dayValue)
        : [...current.available_days, dayValue].sort((a, b) => a - b);

      return { ...current, available_days: nextDays };
    });
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

  const restaurantTypeMeta = getRestaurantTypeMeta(restaurant.restaurant_type);
  const isMadeToOrder = restaurant.restaurant_type === 'made_to_order';
  const isRiceMenu = restaurant.restaurant_type === 'rice_menu';
  const isNoodleShop = restaurant.restaurant_type === 'noodle';
  const isDrinkShop = restaurant.restaurant_type === 'drink';
  const isDessertFruitShop = restaurant.restaurant_type === 'dessert_fruit';
  const isOtherShop = restaurant.restaurant_type === 'other';
  const canManageIngredients = supportsIngredientAvailability(restaurant.restaurant_type);
  const addMenuLabel = isMadeToOrder
    ? '+ เพิ่มเมนูแนะนำ'
    : isNoodleShop
      ? '+ เพิ่มเมนูก๋วยเตี๋ยว'
    : isDrinkShop
      ? '+ เพิ่มเมนูน้ำ'
      : isDessertFruitShop
        ? '+ เพิ่มเมนูขนม/ผลไม้'
        : isOtherShop
          ? '+ เพิ่มเมนูร้าน'
          : '+ เพิ่มเมนูราดข้าว';
  const addMenuTitle = addMenuLabel.replace('+ ', '');
  const menuNamePlaceholder = isDrinkShop
    ? 'เช่น ชานมเย็น, โกโก้เย็น, น้ำแดงโซดา'
    : isNoodleShop
      ? 'เช่น ก๋วยเตี๋ยวหมูน้ำใส, บะหมี่ต้มยำ, เกาเหลาเนื้อ'
    : isDessertFruitShop
      ? 'เช่น สละลอยแก้ว, แตงโม, ข้าวเหนียวมะม่วง'
      : isOtherShop
        ? 'เช่น เมนูขายดีประจำร้าน, เซตพิเศษ, ของทานเล่น'
      : 'เช่น ข้าวกะเพราหมูกรอบไข่ดาว';
  const menuDescriptionLabel = isDrinkShop
    ? 'รายละเอียดเมนูน้ำ'
    : isNoodleShop
      ? 'รายละเอียดเมนูก๋วยเตี๋ยว'
    : isDessertFruitShop
      ? 'รายละเอียดขนมหวาน/ผลไม้'
      : isOtherShop
        ? 'รายละเอียดเมนู'
      : 'รายละเอียดเมนูย่อย';
  const menuDescriptionPlaceholder = isDrinkShop
    ? 'เช่น หวานน้อย เพิ่มไข่มุกได้'
    : isNoodleShop
      ? 'เช่น เลือกเส้นได้ น้ำใส/ต้มยำ/น้ำตก เพิ่มลูกชิ้นได้'
    : isDessertFruitShop
      ? 'เช่น ผลไม้สดประจำวัน หรือรายละเอียดชุดขนม'
      : isOtherShop
        ? 'เช่น รายละเอียดตัวเลือก ระดับความเผ็ด หรือหมายเหตุของเมนู'
      : 'คำอธิบายสั้นๆ...';
  const orderFlowText = isMadeToOrder
    ? 'ลูกค้าเขียนเมนูเอง เลือกพิเศษ และเลือกเวลาไปรับอาหารได้'
    : isRiceMenu
      ? 'ร้านจัดเมนูราดข้าวรายวัน ลูกค้าเลือกพิเศษ และเลือกเวลาไปรับอาหารได้'
      : isNoodleShop
        ? 'ร้านจัดเมนูก๋วยเตี๋ยวรายวัน ลูกค้าเลือกพิเศษ และเลือกเวลาไปรับอาหารได้'
      : isDrinkShop
        ? 'ร้านจัดเมนูน้ำให้ลูกค้าเลือก แล้วลูกค้าเลือกเวลาไปรับอาหารได้'
        : isDessertFruitShop
          ? 'ร้านจัดเมนูขนมหวาน/ผลไม้รายวัน แล้วปิดเมนูที่หมดได้ทันที'
          : 'ร้านจัดเมนูรายวัน ลูกค้าเลือกเมนูและเวลาไปรับอาหารได้';
  const emptyMenuText = isMadeToOrder
    ? 'ยังไม่มีเมนูแนะนำ ลูกค้ายังเขียนเมนูตามสั่งเองได้'
    : `ยังไม่มี${restaurantTypeMeta.label}ในร้านนี้`;
  const todayIndex = getBangkokDayIndex();
  const todayLabel = WEEKDAY_OPTIONS.find((day) => day.value === todayIndex)?.label || 'วันนี้';
  const todayMenusCount = menus.filter((menu) => {
    const availableDays = Array.isArray(menu.available_days) ? menu.available_days : ALL_WEEKDAY_VALUES;
    return availableDays.includes(todayIndex);
  }).length;
  const categoriesById = new Map(categories.map((category, index) => [
    category.id,
    { ...category, toneClass: getMenuCategoryToneClasses(index) },
  ]));
  const categorySuggestions = getMenuCategorySuggestions(restaurant.restaurant_type)
    .filter((name) => !categories.some((category) => String(category.name).toLowerCase() === name.toLowerCase()));

  return (
    <div className="bg-neutral-950 min-h-screen text-white relative">
      
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/orders" className="text-xs font-bold text-neutral-500 hover:text-orange-500 transition-colors uppercase tracking-wider">
          ← กลับไปหน้ารับออเดอร์
        </Link>
      </div>

      {/* 🏪 ส่วนแสดงข้อมูลร้าน */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-5 lg:p-6 mb-6 sm:mb-8 flex flex-col lg:flex-row gap-4 lg:gap-6 shadow-xl relative group">
        
        {/* 🔥 ปุ่มสำหรับแก้ไขข้อมูลร้านอาหาร & ปุ่มดูสมาชิกประจำร้าน */}
        <div className="static mb-2 flex flex-wrap items-center gap-2 lg:absolute lg:top-4 lg:right-4 lg:mb-0">
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
          <img src={restaurant.image_url} alt={restaurant.name} className="h-36 w-full object-cover rounded-xl border border-neutral-800 shadow-md shrink-0 bg-neutral-950 sm:h-44 sm:w-44" />
        ) : (
          <div className="h-36 w-full bg-neutral-950 rounded-xl flex items-center justify-center border border-neutral-800 text-neutral-600 shrink-0 sm:h-44 sm:w-44">🏪 No Image</div>
        )}
        <div className="flex-1 w-full min-w-0 pr-0 lg:pr-48">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl font-black text-white">{restaurant.name}</h1>
            <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider border ${
              isOpenNow ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {isOpenNow ? 'OPEN' : 'CLOSED'}
            </span>
            <span className="rounded border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-300">
              {restaurantTypeMeta.label}
            </span>
          </div>
          <p className="text-sm text-neutral-400 mb-4">{restaurant.description || 'ไม่มีคำอธิบายร้าน'}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4 border-t border-neutral-800/60 text-xs text-neutral-400">
            <p>📍 <strong>ที่อยู่:</strong> {restaurant.address || '-'}</p>
            <p>📞 <strong>เบอร์โทร:</strong> {restaurant.phone ? formatThaiPhoneInput(restaurant.phone) : '-'}</p>
            {restaurant.email && <p>📧 <strong>อีเมล:</strong> {restaurant.email}</p>}
            <p className="sm:col-span-2 text-orange-400 font-bold">
              🕒 เวลาทำการ: {formatTimeDisplay(restaurant.open_time)} - {formatTimeDisplay(restaurant.close_time)} น.
            </p>
          </div>
          {canManageIngredients && (
            <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black text-white">วัตถุดิบร้านตามสั่ง</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">กดวัตถุดิบเพื่อสลับหมด/พร้อมขาย</p>
                </div>
                {restaurant.unavailable_ingredients?.length > 0 ? (
                  <span className="w-fit rounded-full border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] font-black text-red-300">
                    หมด {restaurant.unavailable_ingredients.length} รายการ
                  </span>
                ) : (
                  <span className="w-fit rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                    พร้อมครบ
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {COMMON_INGREDIENTS.map((ingredient) => {
                  const isUnavailable = restaurant.unavailable_ingredients?.includes(ingredient);

                  return (
                    <button
                      key={ingredient}
                      type="button"
                      disabled={actionLoading || !canManage}
                      onClick={() => handleToggleIngredientAvailability(ingredient)}
                      className={`rounded-lg border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isUnavailable
                          ? 'border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300'
                      }`}
                    >
                      {isUnavailable ? 'หมด: ' : 'มี: '}{ingredient}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-neutral-500">ถ้าลูกค้าเขียนเมนูที่มีวัตถุดิบหมด ระบบจะแจ้งเตือนและไม่ให้ใส่ตะกร้า</p>
            </div>
          )}
        </div>
      </div>

      {/* 🍽️ ส่วนจัดการเมนูอาหาร */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6 border-b border-neutral-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-orange-500 uppercase tracking-wide">{restaurantTypeMeta.label}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{orderFlowText}</p>
            <p className="mt-1 text-[11px] text-neutral-600">รายการในร้านนี้ ({menus.length})</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
                {addMenuLabel}
              </button>
            )}
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3 sm:mb-6 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-black text-sky-300">Tag / หมวดเมนู</h3>
              <p className="mt-1 text-xs text-neutral-500">
                แยกเมนูเป็นหมวด เช่น น้ำอัดลม น้ำปั่น ชา กาแฟ หรือหมวดของร้านเอง
              </p>
            </div>
            {canManage && (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-[420px]">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value.slice(0, 40))}
                  placeholder="เช่น น้ำอัดลม, น้ำปั่น, เมนูหมู"
                  className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-bold text-white placeholder-neutral-600 outline-none transition focus:border-sky-500"
                />
                <button
                  type="button"
                  disabled={actionLoading || !newCategoryName.trim()}
                  onClick={() => handleAddCategory()}
                  className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-black text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  เพิ่ม tag
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {categories.length > 0 ? (
              categories.map((category, index) => (
                <span
                  key={category.id}
                  className={`rounded-full border px-3 py-1 text-xs font-black ${getMenuCategoryToneClasses(index)}`}
                >
                  {category.name}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs font-bold text-neutral-500">
                ยังไม่มี tag เมนู
              </span>
            )}
          </div>

          {categorySuggestions.length > 0 && canManage && (
            <div className="mt-3">
              <p className="text-[11px] font-bold text-neutral-500">tag แนะนำ</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categorySuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleAddCategory(name)}
                    className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs font-bold text-neutral-300 transition hover:border-sky-500/40 hover:text-sky-300 disabled:opacity-50"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div id="daily-menu" className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 sm:mb-6 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-black text-amber-300">จัดการอาหารรายวัน</h3>
              <p className="mt-1 text-xs text-neutral-500">
                ติ๊กวันที่เมนูจะเข้าร้าน หน้าเลือกร้านจะแสดงเฉพาะเมนูของวันนั้น
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-bold text-neutral-300">
              {todayLabel}: <span className="text-amber-400">{todayMenusCount}</span> เมนูที่แสดงวันนี้
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {WEEKDAY_OPTIONS.map((day) => (
              <div
                key={day.value}
                className={`rounded-lg border px-2 py-2 text-center text-[10px] font-black shadow-lg ${
                  day.value === todayIndex
                    ? getWeekdayToneClasses(day.value, 'today')
                    : getWeekdayToneClasses(day.value, 'selected')
                }`}
              >
                {day.shortLabel}
              </div>
            ))}
          </div>
        </div>

        {menus.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {menus.map((menu) => {
              const menuAvailableDays = Array.isArray(menu.available_days) ? menu.available_days : ALL_WEEKDAY_VALUES;
              const isOnToday = menuAvailableDays.includes(todayIndex);
              const menuCategory = menu.category_id ? categoriesById.get(menu.category_id) : null;

              return (
              <div key={menu.id} className={`bg-neutral-900 border rounded-xl p-3 flex flex-col gap-3 hover:border-neutral-700 transition-all relative group shadow-md sm:p-4 md:flex-row ${
                isOnToday ? 'border-amber-500/25' : 'border-neutral-800'
              }`}>
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
                  <img src={menu.image_url} alt={menu.name} className="h-28 w-full rounded-lg object-cover bg-neutral-950 border border-neutral-800/80 shrink-0 md:h-20 md:w-20" />
                ) : (
                  <div className="h-28 w-full rounded-lg bg-neutral-950 flex items-center justify-center text-[10px] text-neutral-600 font-bold border border-neutral-800 shrink-0 md:h-20 md:w-20">🍽️ NO PIC</div>
                )}
                <div className="flex flex-col justify-between flex-1 min-w-0 pr-0 md:pr-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm truncate">{menu.name}</h3>
                      {isOnToday && (
                        <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black text-amber-300">
                          วันนี้
                        </span>
                      )}
                    </div>
                    {menuCategory && (
                      <span className={`mt-1 inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-black ${menuCategory.toneClass}`}>
                        {menuCategory.name}
                      </span>
                    )}
                    <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{menu.description || 'ไม่มีรายละเอียด'}</p>
                    <p className="mt-1 text-[10px] font-bold text-neutral-600">ขาย: {formatAvailableDays(menu.available_days)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/40">
                    <span className="text-orange-500 font-black text-sm">฿{Number(menu.price).toLocaleString()}</span>
                    <button
                      type="button"
                      disabled={actionLoading || !canManage}
                      onClick={() => handleToggleMenuAvailability(menu)}
                      className={`text-[9px] font-black px-2 py-1 rounded uppercase transition disabled:cursor-not-allowed disabled:opacity-60 ${menu.is_available ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'}`}
                    >
                      {menu.is_available ? 'พร้อมขาย' : 'ของหมด'}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const checked = menuAvailableDays.includes(day.value);

                      return (
                        <button
                          key={day.value}
                          type="button"
                          disabled={actionLoading || !canManage}
                          onClick={() => handleToggleMenuDailyAvailability(menu, day.value)}
                          className={`min-h-9 rounded-lg border px-1.5 py-2 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            checked
                              ? getWeekdayToneClasses(day.value, day.value === todayIndex ? 'today' : 'selected')
                              : getWeekdayToneClasses(day.value, 'muted')
                          }`}
                          title={day.label}
                        >
                          {day.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )})}
          </div>
        ) : (
          <div className="bg-neutral-900/40 border border-neutral-800 border-dashed rounded-2xl p-8 text-center sm:p-16">
            <span className="text-4xl block mb-3">🍽️</span>
            <h4 className="text-sm font-bold text-neutral-400">{emptyMenuText}</h4>
          </div>
        )}
      </div>

      {/* 👥 POPUP MODAL: รายชื่อสมาชิก / เจ้าของ / พนักงานในร้าน */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-800 shrink-0">
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
                      className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col gap-4 hover:border-neutral-700 transition-all sm:flex-row sm:items-center sm:justify-between"
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

                      <div className="text-left shrink-0 sm:text-right">
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
            <div className="pt-4 border-t border-neutral-800 flex flex-col gap-3 text-xs text-neutral-500 shrink-0 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-800">
              <h3 className="text-base font-black text-orange-500 uppercase tracking-wide">✏️ แก้ไขข้อมูลร้านอาหาร</h3>
              <button onClick={() => setIsEditRestModalOpen(false)} className="text-neutral-500 hover:text-white text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleUpdateRestaurant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">ชื่อร้านอาหาร *</label>
                <input type="text" required value={editRestData.name} onChange={(e) => setEditRestData({...editRestData, name: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">รูปแบบร้าน</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {RESTAURANT_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        editRestData.restaurant_type === type.value
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="edit_restaurant_type"
                        value={type.value}
                        checked={editRestData.restaurant_type === type.value}
                        onChange={() => setEditRestData({...editRestData, restaurant_type: type.value})}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-2 text-sm font-black text-white">
                        <span className="text-lg">{type.icon}</span>
                        {type.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-neutral-500">{type.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              {supportsIngredientAvailability(editRestData.restaurant_type) && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <label className="block text-xs font-bold text-neutral-400 mb-2">วัตถุดิบที่หมด</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {COMMON_INGREDIENTS.map((ingredient) => {
                      const isUnavailable = editRestData.unavailable_ingredients.includes(ingredient);

                      return (
                        <button
                          key={ingredient}
                          type="button"
                          onClick={() => toggleUnavailableIngredient(ingredient)}
                          className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                            isUnavailable
                              ? 'border-red-500/30 bg-red-500/10 text-red-300'
                              : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-white'
                          }`}
                        >
                          {isUnavailable ? 'หมด: ' : 'มี: '}{ingredient}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">ลูกค้าจะเห็นแจ้งเตือนทันทีถ้าเขียนเมนูที่มีวัตถุดิบที่หมด</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1">เบอร์โทรศัพท์</label>
                  <input type="text" value={editRestData.phone} onChange={(e) => setEditRestData({...editRestData, phone: formatThaiPhoneInput(e.target.value)})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1">อีเมลร้านค้า</label>
                  <input type="email" value={editRestData.email} onChange={(e) => setEditRestData({...editRestData, email: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="flex flex-col-reverse gap-3 pt-2 border-t border-neutral-800 mt-4 sm:flex-row sm:justify-end">
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
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-800">
              <div>
                <h3 className="text-base font-black text-orange-500 uppercase tracking-wide">✨ {addMenuTitle}</h3>
                <p className="mt-1 text-xs text-neutral-500">{orderFlowText}</p>
              </div>
              <button onClick={() => { setIsModalOpen(false); setImageFile(null); }} className="text-neutral-500 hover:text-white text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleAddMenu} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">{isDrinkShop ? 'ชื่อเมนูน้ำ *' : isNoodleShop ? 'ชื่อเมนูก๋วยเตี๋ยว *' : isDessertFruitShop ? 'ชื่อเมนูขนมหวาน/ผลไม้ *' : isOtherShop ? 'ชื่อเมนู *' : isMadeToOrder ? 'ชื่อเมนูแนะนำ *' : 'ชื่อเมนูราดข้าว *'}</label>
                <input type="text" required placeholder={menuNamePlaceholder} value={newMenu.name} onChange={(e) => setNewMenu({...newMenu, name: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">Tag / หมวดเมนู</label>
                <select
                  value={newMenu.category_id}
                  onChange={(event) => setNewMenu({...newMenu, category_id: event.target.value})}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-500"
                >
                  <option value="">ไม่ระบุ tag</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-neutral-500">
                  {isNoodleShop ? 'เช่น ก๋วยเตี๋ยว, ต้มยำ, น้ำตก, แห้ง หรือเกาเหลา' : isOtherShop ? 'เช่น เมนูแนะนำ, ขายดี, เซตพิเศษ หรือของทานเล่น' : 'เช่น ร้านน้ำเลือก น้ำอัดลม, น้ำปั่น, ชา หรือกาแฟ'}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-xs font-bold text-neutral-400">เมนูนี้เข้าวันไหนบ้าง</label>
                  <span className="text-[10px] font-bold text-neutral-600">{formatAvailableDays(newMenu.available_days)}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const checked = newMenu.available_days.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleNewMenuDay(day.value)}
                        className={`min-h-9 rounded-lg border px-2 py-2 text-[10px] font-black transition ${
                          checked
                            ? getWeekdayToneClasses(day.value, day.value === todayIndex ? 'today' : 'selected')
                            : getWeekdayToneClasses(day.value, 'muted')
                        }`}
                        title={day.label}
                      >
                        {day.shortLabel}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewMenu((current) => ({ ...current, available_days: ALL_WEEKDAY_VALUES }))}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[10px] font-black text-neutral-300 hover:border-amber-500/40 hover:text-amber-300"
                  >
                    เลือกทุกวัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMenu((current) => ({ ...current, available_days: [] }))}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[10px] font-black text-neutral-300 hover:border-red-500/40 hover:text-red-300"
                  >
                    ล้างวัน
                  </button>
                </div>
                <p className="mt-2 text-xs text-neutral-500">ถ้าไม่ติ๊กวันไหน เมนูนั้นจะไม่แสดงในหน้าลูกค้าของวันนั้น</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">รูปภาพเมนูอาหาร</label>
                <input type="file" accept="image/*" onChange={(e) => e.target.files && setImageFile(e.target.files[0])} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">{menuDescriptionLabel}</label>
                <textarea rows={2} placeholder={menuDescriptionPlaceholder} value={newMenu.description} onChange={(e) => setNewMenu({...newMenu, description: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none" />
              </div>
              <div className="flex flex-col-reverse gap-3 pt-2 border-t border-neutral-800 mt-4 sm:flex-row sm:justify-end">
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
