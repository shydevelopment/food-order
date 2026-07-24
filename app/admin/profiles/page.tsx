'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminUsersPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // ⚡ State สำหรับระบบ Popup Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // 🆕 เพิ่ม State สำหรับ Username และ Email
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, phone, role, email')
        .order('username', { ascending: true });

      if (error) throw error;
      if (data) setProfiles(data);
    } catch (error: any) {
      console.error('Error:', error.message);
      alert('ไม่สามารถดึงข้อมูลได้: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (user: any) => {
    setSelectedUser(user);
    setUsernameInput(user.username || '');
    setEmailInput(user.email || '');
    setFullNameInput(user.full_name || '');
    setPhoneInput(user.phone || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsClosing(false);
      setSelectedUser(null);
    }, 200);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSubmitLoading(true);
    try {
      // 💾 บันทึกข้อมูลที่แก้ไขรวมถึง username และ email ลงฐานข้อมูล Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          username: usernameInput,
          email: emailInput,
          full_name: fullNameInput,
          phone: phoneInput,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      alert('💾 บันทึกการแก้ไขข้อมูลสำเร็จ!');
      handleCloseModal();
      fetchProfiles(); 
    } catch (error: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredProfiles = profiles.filter((user) => {
    return (
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm)
    );
  });

  return (
    <div className="relative">
      {/* ส่วนหัวของหน้าจอ */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wide">
            👥 ข้อมูลผู้ใช้งานทั้งหมด
          </h2>
          <p className="text-sm text-gray-400">
            ดูรายละเอียดโปรไฟล์ ชื่อผู้ใช้ เบอร์โทรศัพท์ และบทบาทในระบบ
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-xs">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาชื่อ, Username, อีเมล หรือเบอร์โทร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-550 focus:outline-none focus:border-orange-550 transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-orange-500 animate-pulse font-bold tracking-wide">
          กำลังดึงข้อมูลโปรไฟล์ผู้ใช้งาน...
        </div>
      ) : (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-neutral-800 text-center">
              <thead>
                <tr className="bg-neutral-950 text-gray-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                  <th className="p-4 font-medium text-center border-r border-neutral-800 w-24">รูปภาพ</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">ชื่อจริง / Full Name</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">ชื่อผู้ใช้ / Username</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">อีเมล / Email</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">เบอร์โทรศัพท์</th>
                  <th className="p-4 font-medium text-center border-r border-neutral-800">บทบาท (Role)</th>
                  <th className="p-4 font-medium text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-sm">
                {filteredProfiles.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="p-4 border-r border-neutral-800">
                      <div className="flex justify-center">
                        {user.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
                            alt="avatar" 
                            className="w-10 h-10 rounded-full border border-neutral-700 object-cover" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-orange-500 font-black">
                            {(user.full_name || user.username || 'U')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-white border-r border-neutral-800 text-center">
                      {user.full_name || <span className="text-neutral-600 font-normal italic">ไม่ได้ระบุ</span>}
                    </td>
                    <td className="p-4 text-gray-300 border-r border-neutral-800 text-center">
                      @{user.username || 'ไม่มี username'}
                    </td>
                    <td className="p-4 text-gray-400 break-all border-r border-neutral-800 text-center">
                      {user.email || <span className="text-neutral-600 font-normal italic">ไม่มีอีเมล</span>}
                    </td>
                    <td className="p-4 font-mono text-gray-400 border-r border-neutral-800 text-center">
                      {user.phone || <span className="text-neutral-600 font-normal italic">ไม่มีข้อมูล</span>}
                    </td>
                    <td className="p-4 text-center border-r border-neutral-800">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border
                        ${user.role === 'admin' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 
                          user.role === 'customer' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                          user.role === 'restaurant' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 
                          user.role === 'student' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 
                          user.role === 'teacher' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                          'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(user)}
                          className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-550/10 hover:bg-blue-550/20 px-2.5 py-1.5 rounded border border-blue-500/20"
                        >
                          แก้ไข
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProfiles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-gray-500">
                      ไม่พบข้อมูลโปรไฟล์ผู้ใช้งานที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ⚡ POP-UP MODAL แก้ไขข้อมูล */}
      {/* ========================================== */}
      {(isModalOpen || isClosing) && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}>
          
          <style>{`
            @keyframes smoothFadeIn {
              from { opacity: 0; backdrop-filter: blur(0px); }
              to { opacity: 1; backdrop-filter: blur(4px); }
            }
            @keyframes smoothFadeOut {
              from { opacity: 1; backdrop-filter: blur(4px); }
              to { opacity: 0; backdrop-filter: blur(0px); }
            }
            @keyframes smoothSlideUp {
              from { opacity: 0; transform: scale(0.95) translateY(12px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes smoothSlideDown {
              from { opacity: 1; transform: scale(1) translateY(0); }
              to { opacity: 0; transform: scale(0.95) translateY(12px); }
            }
            
            .animate-backdrop-in { animation: smoothFadeIn 0.2s ease-out forwards; }
            .animate-backdrop-out { animation: smoothFadeOut 0.2s ease-in forwards; }
            .animate-content-in { animation: smoothSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            .animate-content-out { animation: smoothSlideDown 0.2s ease-in forwards; }
          `}</style>

          <div className={`w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl ${isClosing ? 'animate-content-out' : 'animate-content-in'}`}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800">
              <h3 className="text-lg font-black text-white">✏️ แก้ไขข้อมูลโปรไฟล์</h3>
              <button 
                type="button"
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-white transition-colors text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveChanges} className="space-y-4">
              {/* 🟢 แก้ไขได้: ชื่อผู้ใช้ / Username */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">ชื่อผู้ใช้ / Username</label>
                <input 
                  type="text" 
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors"
                />
              </div>

              {/* 🟢 แก้ไขได้: อีเมล / Email Address */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">อีเมล / Email Address</label>
                <input 
                  type="email" 
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors"
                />
              </div>

              {/* ชื่อจริง / Full Name */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">ชื่อจริง / Full Name</label>
                <input 
                  type="text" 
                  required
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  placeholder="กรอกชื่อ-นามสกุลจริง..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors"
                />
              </div>

              {/* เบอร์โทรศัพท์ / Phone */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">เบอร์โทรศัพท์ / Phone</label>
                <input 
                  type="text" 
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="เช่น 0891234567..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-orange-550 transition-colors font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="bg-neutral-800 hover:bg-neutral-700 text-gray-300 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-black px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-orange-500/10"
                >
                  {submitLoading ? 'กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}