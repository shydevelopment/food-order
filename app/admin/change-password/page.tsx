'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS_TEXT, validatePasswordPolicy } from '@/lib/password-policy';
import PasswordRequirements from '@/components/password-requirements';
import { getAccountRoleMeta } from '@/lib/roles';

interface PasswordTargetUser {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: string | null;
  phone: string | null;
}

export default function AdminChangePasswordPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [users, setUsers] = useState<PasswordTargetUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<PasswordTargetUser | null>(null);

  // 🔔 State สำหรับ Pop-up แจ้งเตือน (พร้อมตัวแปรจัดการจังหวะปิด Fade Out)
  const [showWarningModal, setShowWarningModal] = useState(true);
  const [isWarningClosing, setIsWarningClosing] = useState(false);

  // Input States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadUsers = async () => {
      await Promise.resolve();
      if (!isActive) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, email, role, phone')
          .order('username', { ascending: true });

        if (error) throw error;
        if (data && isActive) setUsers(data);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้';
        console.error('Error fetching users:', message);
        alert('ไม่สามารถดึงข้อมูลผู้ใช้ได้: ' + message);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadUsers();

    return () => {
      isActive = false;
    };
  }, [supabase]);

  // ⚡ ฟังก์ชันปิด Pop-up เตือนความปลอดภัยพร้อมเล่นอนิเมชัน Fade-Out
  const handleCloseWarningModal = () => {
    setIsWarningClosing(true);
    setTimeout(() => {
      setShowWarningModal(false);
      setIsWarningClosing(false);
    }, 200); // หน่วงเวลา 200ms ให้จังหวะ Fade Out ทำงานสมบูรณ์
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      alert('กรุณาเลือกผู้ใช้งานที่ต้องการเปลี่ยนรหัสผ่าน');
      return;
    }

    const passwordPolicyError = validatePasswordPolicy(newPassword);
    if (passwordPolicyError) {
      alert('❌ ' + passwordPolicyError);
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('❌ รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      }

      alert(`✨ เปลี่ยนรหัสผ่านให้บัญชี "${selectedUser.full_name || selectedUser.username}" เรียบร้อยแล้ว!`);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน';
      alert('เกิดข้อผิดพลาด: ' + message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    return (
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="relative">
      {/* ส่วนหัวของหน้าจอ */}
      <div className="mb-5 sm:mb-8">
        <h2 className="text-xl font-black text-white uppercase tracking-wide sm:text-3xl">
          🔐 รีเซ็ต / เปลี่ยนรหัสผ่านผู้ใช้งาน
        </h2>
        <p className="mt-1.5 text-sm text-gray-300 sm:text-base">
          เลือกผู้ใช้งานที่ต้องการ และกำหนดรหัสผ่านใหม่สำหรับเข้าสู่ระบบ
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* คอลัมน์ซ้าย: ค้นหาและเลือกรายชื่อผู้ใช้งาน */}
        <div className="lg:col-span-5  border border-neutral-800 rounded-xl p-3 flex flex-col shadow-2xl sm:p-5">
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">
              1. ค้นหาผู้ใช้งานที่ต้องการเปลี่ยนรหัสผ่าน
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="ค้นหาชื่อ ชื่อผู้ใช้ หรืออีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full  border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-550 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar">
            {loading ? (
              <div className="py-16 text-center text-sm text-orange-500 animate-pulse font-bold">
                กำลังดึงข้อมูลรายชื่อ...
              </div>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'bg-orange-500/10 border-orange-500/60 shadow-md ring-1 ring-orange-500/30'
                        : ' border-neutral-800/80 '
                    }`}
                  >
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt="รูปโปรไฟล์"
                        className="w-11 h-11 rounded-full border border-neutral-700 object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full  border border-neutral-700 flex items-center justify-center text-orange-500 font-black text-sm shrink-0">
                        {(u.full_name || u.username || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-base font-bold truncate ${isSelected ? 'text-orange-400' : 'text-white'}`}>
                        {u.full_name || u.username}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">@{u.username || 'ไม่มี username'}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email || 'ไม่มีอีเมล'}</p>
                    </div>
                    {isSelected && <span className="text-base text-orange-400 font-bold">✓</span>}
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-sm text-neutral-500">
                ไม่พบรายชื่อผู้ใช้งานที่ตรงกับคำค้นหา
              </div>
            )}
          </div>
        </div>

        {/* คอลัมน์ขวา: ฟอร์มตั้งรหัสผ่านใหม่ */}
        <div className="lg:col-span-7  border border-neutral-800 rounded-xl p-4 shadow-2xl flex flex-col justify-between sm:p-6">
          <div>
            <h3 className="text-base font-bold text-gray-200 uppercase tracking-wide mb-5 border-b border-neutral-800 pb-3">
              2. กรอกรหัสผ่านใหม่
            </h3>

            {selectedUser ? (
              <div>
                {/* ข้อมูลสรุปของบัญชีที่เลือก */}
                <div className="mb-6 p-4  rounded-xl border border-neutral-800 flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:text-left">
                  {selectedUser.avatar_url ? (
                    <img
                      src={selectedUser.avatar_url}
                      alt="รูปโปรไฟล์"
                      className="w-14 h-14 rounded-full border-2 border-orange-500 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center text-xl font-black text-black shrink-0">
                      {(selectedUser.full_name || selectedUser.username || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                      <p className="text-lg font-bold text-white truncate">
                        {selectedUser.full_name || 'ไม่ได้ระบุชื่อจริง'}
                      </p>
                      <span className="text-xs font-black px-2.5 py-0.5  text-orange-400 rounded border border-neutral-700 uppercase">
                        {getAccountRoleMeta(selectedUser.role)?.thaiLabel || 'User'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1 break-all">Username: @{selectedUser.username || '-'}</p>
                    <p className="text-sm text-gray-400 break-all">Email: {selectedUser.email || '-'}</p>
                  </div>
                </div>

                {/* แบบฟอร์มเปลี่ยนรหัสผ่าน */}
                <form onSubmit={handlePasswordReset} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">
                      รหัสผ่านใหม่ (New Password) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      pattern={PASSWORD_PATTERN}
                      title={PASSWORD_REQUIREMENTS_TEXT}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="อย่างน้อย 8 ตัว มี A-Z, 0-9 และ @"
                      className="w-full  border border-neutral-800 rounded-lg px-4 py-3 text-base text-white placeholder-neutral-600 focus:outline-none focus:border-orange-550 transition-colors"
                    />
                    <PasswordRequirements password={newPassword} className="mt-2" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">
                      ยืนยันรหัสผ่านใหม่ (Confirm New Password) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      pattern={PASSWORD_PATTERN}
                      title={PASSWORD_REQUIREMENTS_TEXT}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง..."
                      className="w-full  border border-neutral-800 rounded-lg px-4 py-3 text-base text-white placeholder-neutral-600 focus:outline-none focus:border-orange-550 transition-colors"
                    />
                  </div>

                  <div className="pt-5 border-t border-neutral-800 mt-8 flex justify-stretch sm:justify-end">
                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-black px-7 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-orange-500/10 active:scale-95 cursor-pointer sm:w-auto"
                    >
                      {submitLoading ? 'กำลังบันทึกรหัสผ่านใหม่...' : '💾 บันทึกรหัสผ่านใหม่'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="py-14 text-center border-2 border-dashed border-neutral-800 rounded-xl  sm:py-28">
                <p className="text-4xl mb-3">👈</p>
                <p className="text-base font-bold text-gray-300">กรุณาเลือกผู้ใช้งานจากรายการทางด้านซ้าย</p>
                <p className="text-sm text-neutral-500 mt-1">เพื่อเริ่มต้นกำหนดรหัสผ่านใหม่ให้กับผู้ใช้งานนั้น</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ⚠️ POP-UP แจ้งเตือนข้อควรระวังพร้อมอนิเมชัน Fade-In / Fade-Out */}
      {/* ========================================================= */}
      {(showWarningModal || isWarningClosing) && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 bg-black/80 backdrop-blur-md sm:p-4 ${isWarningClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}>
          <style>{`
            @keyframes smoothFadeIn {
              from { opacity: 0; backdrop-filter: blur(0px); }
              to { opacity: 1; backdrop-filter: blur(8px); }
            }
            @keyframes smoothFadeOut {
              from { opacity: 1; backdrop-filter: blur(8px); }
              to { opacity: 0; backdrop-filter: blur(0px); }
            }
            @keyframes smoothSlideUp {
              from { opacity: 0; transform: scale(0.9) translateY(12px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes smoothSlideDown {
              from { opacity: 1; transform: scale(1) translateY(0); }
              to { opacity: 0; transform: scale(0.9) translateY(12px); }
            }

            .animate-backdrop-in { animation: smoothFadeIn 0.25s ease-out forwards; }
            .animate-backdrop-out { animation: smoothFadeOut 0.2s ease-in forwards; }
            .animate-modal-in { animation: smoothSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            .animate-modal-out { animation: smoothSlideDown 0.2s ease-in forwards; }
          `}</style>

          <div className={`w-full max-w-lg  border border-neutral-800 rounded-2xl p-4 shadow-2xl text-center relative overflow-hidden sm:p-6 md:p-8 ${isWarningClosing ? 'animate-modal-out' : 'animate-modal-in'}`}>
            {/* แถบสีไฮไลท์ด้านบน */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />

            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl text-amber-500">
              ⚠️
            </div>

            <h3 className="text-xl font-black text-white mb-2 sm:text-2xl">
              คำเตือนความปลอดภัย Admin
            </h3>
            
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              คุณกำลังเข้าสู่ระบบเปลี่ยนรหัสผ่านผู้ใช้งานสิทธิ์ Admin (Admin Access) โปรดอ่านและทำความเข้าใจข้อควรระวังก่อนดำเนินการ
            </p>

            <div className=" border border-neutral-800 rounded-xl p-4 mb-6 text-left space-y-2.5 text-xs text-gray-300">
              <div className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold shrink-0">•</span>
                <span><strong>มีผลทันที:</strong> การเปลี่ยนรหัสผ่านจะมีผลกับบัญชีนั้นๆ ทันที ผู้ใช้เดิมจะถูกตัดการเชื่อมต่อ</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold shrink-0">•</span>
                <span><strong>ตรวจสอบบัญชี:</strong> กรุณาตรวจสอบชื่อผู้ใช้และอีเมลให้ถูกต้องก่อนกดบันทึกรหัสผ่านใหม่</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold shrink-0">•</span>
                <span><strong>แจ้งรหัสผ่านอย่างปลอดภัย:</strong> โปรดแจ้งรหัสผ่านใหม่แก่ผู้ใช้ผ่านช่องทางที่ปลอดภัยเท่านั้น</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseWarningModal}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/10 active:scale-95 cursor-pointer"
            >
              เข้าใจแล้ว / เข้าสู่หน้ารีเซ็ตรหัสผ่าน
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
