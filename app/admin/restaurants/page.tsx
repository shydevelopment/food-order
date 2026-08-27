'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { DEFAULT_RESTAURANT_TYPE, getRestaurantTypeMeta, RESTAURANT_TYPES } from '@/lib/restaurant-types';
import { formatThaiPhoneInput } from '@/lib/phone';

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // ⏱️ State เวลาปัจจุบัน สำหรับกระตุ้นให้สถานะอัปเดตแบบ Real-time
  const [now, setNow] = useState(new Date());

  // ⚡ State สำหรับระบบ Popup Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('edit'); 
  const [selectedRest, setSelectedRest] = useState<any>(null);
  
  // Input States
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState(''); 
  const [phoneInput, setPhoneInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [openTimeInput, setOpenTimeInput] = useState('08:00:00');
  const [closeTimeInput, setCloseTimeInput] = useState('20:00:00');
  const [addressInput, setAddressInput] = useState('');
  const [statusInput, setStatusInput] = useState('open');
  const [restaurantTypeInput, setRestaurantTypeInput] = useState(DEFAULT_RESTAURANT_TYPE);
  const [imageFile, setImageFile] = useState<File | null>(null); 
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchRestaurants();

    // 🔄 ตัวนับเวลาให้อัปเดตสถานะอัตโนมัติทุกๆ 30 วินาที
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // 🕒 ฟังก์ชันคำนวณสถานะร้านอาหาร (มีแค่ "เปิดบริการ" และ "ปิดร้าน")
  const getRestaurantStatus = (openTime?: string, closeTime?: string, dbStatus?: string) => {
    // 1. ถ้าร้านถูกตั้งค่าปิดแบบ Manual ให้ปิดร้านทันที
    if (dbStatus === 'closed') {
      return {
        label: 'ปิดร้าน',
        badgeClass: 'bg-red-500/10 text-red-500 border-red-500/30'
      };
    }

    if (!openTime || !closeTime) {
      return {
        label: 'เปิดบริการ',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      };
    }

    // 2. คำนวณเวลาปัจจุบันเทียบกับ open_time และ close_time
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);

    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);

    let isOpenNow = false;

    if (openMinutes < closeMinutes) {
      // เปิด-ปิดภายในวันเดียวกัน (เช่น 08:00 - 20:00)
      isOpenNow = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    } else if (openMinutes > closeMinutes) {
      // เปิดข้ามคืน (เช่น 18:00 - 02:00)
      isOpenNow = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    } else {
      // เวลาเปิดปิดเท่ากันถือว่าเปิด 24 ชม.
      isOpenNow = true;
    }

    if (isOpenNow) {
      return {
        label: 'เปิดบริการ',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      };
    } else {
      return {
        label: 'ปิดร้าน',
        badgeClass: 'bg-red-500/10 text-red-500 border-red-500/30'
      };
    }
  };

  // ฟังก์ชันดึงข้อมูลจริงจาก Supabase
  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/restaurants');
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถดึงข้อมูลร้านอาหารได้');
      setRestaurants(result.restaurants || []);
    } catch (error: any) {
      console.error('Error:', error.message);
      alert('ไม่สามารถดึงข้อมูลร้านอาหารได้: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setSelectedRest(null);
    setNameInput('');
    setEmailInput('');
    setPhoneInput('');
    setDescriptionInput('');
    setOpenTimeInput('08:00:00');
    setCloseTimeInput('20:00:00');
    setAddressInput('');
    setStatusInput('open');
    setRestaurantTypeInput(DEFAULT_RESTAURANT_TYPE);
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (restaurant: any) => {
    setModalMode('edit');
    setSelectedRest(restaurant);
    setNameInput(restaurant.name || '');
    setEmailInput(restaurant.email || '');
    setPhoneInput(formatThaiPhoneInput(restaurant.phone || ''));
    setDescriptionInput(restaurant.description || '');
    setOpenTimeInput(restaurant.open_time || '08:00:00');
    setCloseTimeInput(restaurant.close_time || '20:00:00');
    setAddressInput(restaurant.address || '');
    setStatusInput(restaurant.status || 'open');
    setRestaurantTypeInput(restaurant.restaurant_type || DEFAULT_RESTAURANT_TYPE);
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsClosing(false);
      setSelectedRest(null);
      setImageFile(null);
    }, 200);
  };

  const handleDeleteRestaurant = async () => {
    if (!selectedRest) return;
    
    const userInput = prompt(
      `⚠️ คำเตือน: การลบร้าน "${selectedRest.name}" จะทำลายข้อมูลเมนูอาหารทั้งหมดของร้านนี้ด้วย!\n\nกรุณาพิมพ์ชื่อร้านว่า "${selectedRest.name}" เพื่อยืนยันการลบ:`
    );

    if (userInput === null) return;

    if (userInput !== selectedRest.name) {
      alert('❌ ชื่อร้านไม่ถูกต้อง! ระบบยกเลิกการลบร้านอาหารเพื่อความปลอดภัย');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/admin/restaurants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRest.id,
          name: selectedRest.name,
        }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถลบร้านอาหารได้');

      alert('🗑️ ลบร้านอาหารออกจากระบบเรียบร้อยแล้ว!');
      handleCloseModal();
      fetchRestaurants(); 
    } catch (error: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const uploadRestaurantImage = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'restaurant-logos');

    const res = await fetch('/api/admin/uploads', {
      method: 'POST',
      body: formData,
    });
    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'ไม่สามารถอัปโหลดรูปภาพร้านได้');
    }

    return result.publicUrl as string;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      let uploadedImageUrl = selectedRest?.image_url || null;

      if (imageFile) {
        uploadedImageUrl = await uploadRestaurantImage(imageFile);
      }

      const restaurantPayload = {
        name: nameInput,
        email: emailInput || null,
        phone: phoneInput || null,
        address: addressInput || null,
        status: statusInput,
        image_url: uploadedImageUrl,
        description: descriptionInput || null,
        open_time: openTimeInput,
        close_time: closeTimeInput,
        restaurant_type: restaurantTypeInput,
      };

      if (modalMode === 'add') {
        const res = await fetch('/api/admin/restaurants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(restaurantPayload),
        });
        const result = await res.json();

        if (!res.ok) throw new Error(result.error || 'ไม่สามารถเพิ่มร้านอาหารได้');
        alert('✨ เพิ่มร้านอาหารใหม่เข้าสู่ระบบสำเร็จ!');
      } else {
        if (!selectedRest) return;
        const res = await fetch('/api/admin/restaurants', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedRest.id,
            ...restaurantPayload,
          }),
        });
        const result = await res.json();

        if (!res.ok) throw new Error(result.error || 'ไม่สามารถแก้ไขร้านอาหารได้');
        alert('💾 บันทึกการแก้ไขข้อมูลร้านอาหารสำเร็จ!');
      }

      handleCloseModal();
      fetchRestaurants(); 
    } catch (error: any) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredRestaurants = restaurants.filter((rest) => {
    return (
      rest.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rest.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rest.phone?.includes(searchTerm) ||
      rest.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="relative p-1">
      {/* ส่วนหัวของหน้าจอ */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wide">
            🏢 จัดการร้านอาหารทั้งหมด
          </h2>
          <p className="text-sm text-gray-400">
            ดูรายละเอียด ตรวจสอบสถานะการเปิด-ปิดร้าน และแก้ไขข้อมูลร้านอาหารในระบบ
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-orange-500/10 shrink-0 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>➕</span> เพิ่มร้านอาหาร
          </button>

          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-xs">🔍</span>
            <input
              type="text"
              placeholder="ค้นหาชื่อร้าน, อีเมล หรือเบอร์โทร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full  border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-550 focus:outline-none focus:border-orange-550 transition-colors"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-orange-500 animate-pulse font-bold tracking-wide">
          กำลังดึงข้อมูลร้านอาหาร...
        </div>
      ) : (
        <div className=" rounded-xl border border-neutral-800 overflow-hidden shadow-2xl">
          <div className="responsive-scroll">
            <table className="responsive-table w-full border-collapse border border-neutral-800 text-center">
              <thead>
                <tr className=" text-gray-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                  <th className="p-4 font-medium text-center border-r border-neutral-800 w-24">รูปภาพ</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">ชื่อร้านอาหาร</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">เวลาทำการ</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">อีเมลติดต่อ</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">เบอร์โทรศัพท์</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">สถานะ</th>
                  <th className="p-4 font-medium text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-sm">
                {filteredRestaurants.map((rest) => {
                  const statusInfo = getRestaurantStatus(rest.open_time, rest.close_time, rest.status);

                  return (
                    <tr key={rest.id} className=" transition-colors">
                      <td className="p-4 border-r border-neutral-800">
                        <div className="flex justify-center">
                          {rest.image_url ? (
                            <img
                              src={rest.image_url}
                              alt="ร้านอาหาร"
                              className="w-12 h-12 rounded-lg border border-neutral-700 object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg  border border-neutral-700 flex items-center justify-center text-orange-500 font-black text-lg">
                              🏪
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-white border-r border-neutral-800 text-center">
                        <div>{rest.name}</div>
                        <div className="mt-1">
                          <span className="rounded border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-300">
                            {getRestaurantTypeMeta(rest.restaurant_type).label}
                          </span>
                        </div>
                        {rest.description && <div className="text-[11px] text-gray-500 font-normal mt-0.5 max-w-xs truncate mx-auto">{rest.description}</div>}
                      </td>
                      
                      <td className="p-4 text-orange-400 font-bold border-r border-neutral-800 text-center text-xs font-mono">
                        {rest.open_time?.substring(0, 5) || '08:00'} - {rest.close_time?.substring(0, 5) || '20:00'}
                      </td>

                      <td className="p-4 text-gray-300 border-r border-neutral-800 text-center break-all">{rest.email || '-'}</td>
                      <td className="p-4 font-mono text-gray-400 border-r border-neutral-800 text-center">{rest.phone ? formatThaiPhoneInput(rest.phone) : '-'}</td>
                      
                      {/* 🔥 แสดงเฉพาะ "เปิดบริการ" หรือ "ปิดร้าน" */}
                      <td className="p-4 text-center border-r border-neutral-800">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(rest)}
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-550/10 hover:bg-blue-550/20 px-4 py-1.5 rounded border border-blue-500/20"
                          >
                            แก้ไข
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRestaurants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-gray-500">
                      ไม่พบข้อมูลร้านอาหารที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POP-UP MODAL */}
      {(isModalOpen || isClosing) && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}>
          
          <style>{`
            @keyframes smoothFadeIn { from { opacity: 0; backdrop-filter: blur(0px); } to { opacity: 1; backdrop-filter: blur(4px); } }
            @keyframes smoothFadeOut { from { opacity: 1; backdrop-filter: blur(4px); } to { opacity: 0; backdrop-filter: blur(0px); } }
            @keyframes smoothSlideUp { from { opacity: 0; transform: scale(0.95) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes smoothSlideDown { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.95) translateY(12px); } }
            
            .animate-backdrop-in { animation: smoothFadeIn 0.2s ease-out forwards; }
            .animate-backdrop-out { animation: smoothFadeOut 0.2s ease-in forwards; }
            .animate-content-in { animation: smoothSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            .animate-content-out { animation: smoothSlideDown 0.2s ease-in forwards; }
          `}</style>

          <div className={`w-full max-w-md  border border-neutral-800 rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] ${isClosing ? 'animate-content-out' : 'animate-content-in'}`}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800">
              <h3 className="text-lg font-black text-white">
                {modalMode === 'add' ? '✨ เพิ่มร้านอาหารใหม่' : '✏️ แก้ไขข้อมูลร้านอาหาร'}
              </h3>
              <button 
                type="button"
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-white transition-colors text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                  Email ร้านค้า {modalMode === 'edit' && '(แก้ไขไม่ได้)'}
                </label>
                <input 
                  type="email" 
                  required
                  disabled={modalMode === 'edit'} 
                  value={modalMode === 'edit' ? selectedRest?.email : emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="อีเมลร้านอาหาร"
                  className={`w-full  border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors ${
                    modalMode === 'edit' ? 'text-neutral-500 cursor-not-allowed ' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">ชื่อร้านอาหาร *</label>
                <input 
                  type="text" 
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="กรอกชื่อร้านอาหาร..."
                  className="w-full  border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">รูปแบบร้าน *</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {RESTAURANT_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        restaurantTypeInput === type.value
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-neutral-800  hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="restaurant_type"
                        value={type.value}
                        checked={restaurantTypeInput === type.value}
                        onChange={() => setRestaurantTypeInput(type.value)}
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

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">คำอธิบายรายละเอียดร้าน</label>
                <textarea 
                  rows={2}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="เช่น ร้านกะเพราพริกแห้งรสเด็ด เผ็ดพ่นไฟ..."
                  className="w-full  border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">เบอร์โทรศัพท์ร้าน</label>
                <input 
                  type="text" 
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(formatThaiPhoneInput(e.target.value))}
                  placeholder="กรอกเบอร์โทรติดต่อร้าน..."
                  className="w-full  border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors font-mono"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">เวลาเปิดทำการ</label>
                  <input 
                    type="time" 
                    step="1"
                    required
                    value={openTimeInput}
                    onChange={(e) => setOpenTimeInput(e.target.value)}
                    className="w-full  border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-550 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">เวลาปิดทำการ</label>
                  <input 
                    type="time" 
                    step="1"
                    required
                    value={closeTimeInput}
                    onChange={(e) => setCloseTimeInput(e.target.value)}
                    className="w-full  border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-550 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">รูปภาพโลโก้หน้าร้าน</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => e.target.files && setImageFile(e.target.files[0])}
                  className="w-full  border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold  file:text-white  cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">ที่อยู่ร้านอาหาร</label>
                <textarea 
                  rows={2}
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="ระบุที่ตั้งร้านโดยละเอียด..."
                  className="w-full  border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">สถานะร้านค้า (กำหนดเอง)</label>
                <div className="relative">
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    className="w-full  border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-550 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="open">เปิดระบบปกติ (เปิดตามเวลาทำการ)</option>
                    <option value="closed">ปิดบริการ (บังคับปิดร้าน)</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-500 text-xs">▼</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t border-neutral-800 mt-6 sm:flex-row sm:items-center sm:justify-between">
                {modalMode === 'edit' ? (
                  <button
                    type="button"
                    disabled={submitLoading}
                    onClick={handleDeleteRestaurant}
                    className="bg-red-950/40 hover:bg-red-900/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold border border-red-900/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    🗑️ ลบร้านนี้
                  </button>
                ) : (
                  <div></div> 
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="  text-gray-300 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-black px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-orange-500/10"
                  >
                    {submitLoading ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
                  </button>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
