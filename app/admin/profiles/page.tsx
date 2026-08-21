'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ACCOUNT_ROLES, getAccountRoleMeta, resolveAccountRoleForEmail } from '@/lib/roles';
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS_TEXT, validatePasswordPolicy } from '@/lib/password-policy';
import PasswordRequirements from '@/components/password-requirements';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string | null;
  email: string | null;
}

export default function AdminUsersPage() {
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // ⚡ State สำหรับระบบ Popup Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // 🆕 เพิ่ม State สำหรับ Username และ Email
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [roleInput, setRoleInput] = useState('customer');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newFullNameInput, setNewFullNameInput] = useState('');
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [newConfirmPasswordInput, setNewConfirmPasswordInput] = useState('');
  const [newRoleInput, setNewRoleInput] = useState('customer');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, phone, role, email')
        .order('username', { ascending: true });

      if (error) throw error;
      if (data) setProfiles(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error:', message);
      alert('ไม่สามารถดึงข้อมูลได้: ' + message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfiles();
  }, [fetchProfiles]);

  const handleOpenEditModal = (user: Profile) => {
    setSelectedUser(user);
    setUsernameInput(user.username || '');
    setEmailInput(user.email || '');
    setFullNameInput(user.full_name || '');
    setPhoneInput(user.phone || '');
    setRoleInput(user.role || 'customer');
    setIsModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setNewUsernameInput('');
    setNewEmailInput('');
    setNewFullNameInput('');
    setNewPhoneInput('');
    setNewPasswordInput('');
    setNewConfirmPasswordInput('');
    setNewRoleInput('customer');
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    if (createLoading) return;
    setIsAddModalOpen(false);
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

      if (roleInput !== (selectedUser.role || 'customer')) {
        const roleRes = await fetch('/api/admin/update-role', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser.id,
          role: resolveAccountRoleForEmail(emailInput, roleInput),
          }),
        });

        const roleResult = await roleRes.json();

        if (!roleRes.ok) {
          throw new Error(roleResult.error || 'ไม่สามารถเปลี่ยน role ได้');
        }
      }

      alert('💾 บันทึกการแก้ไขข้อมูลสำเร็จ!');
      handleCloseModal();
      fetchProfiles(); 
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPasswordInput !== newConfirmPasswordInput) {
      alert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    const passwordPolicyError = validatePasswordPolicy(newPasswordInput);
    if (passwordPolicyError) {
      alert(passwordPolicyError);
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmailInput.trim(),
          password: newPasswordInput,
          username: newUsernameInput.trim(),
          fullName: newFullNameInput.trim(),
          phone: newPhoneInput.trim(),
          role: resolveAccountRoleForEmail(newEmailInput, newRoleInput),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถเพิ่มบัญชีได้');
      }

      alert('✅ เพิ่มบัญชีผู้ใช้สำเร็จ!');
      setIsAddModalOpen(false);
      fetchProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('เกิดข้อผิดพลาดในการเพิ่มบัญชี: ' + message);
    } finally {
      setCreateLoading(false);
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

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-orange-500/10 transition-all hover:bg-orange-600 active:scale-95"
          >
            <span>➕</span>
            เพิ่มบัญชี
          </button>

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
      </div>

      {loading ? (
        <div className="py-20 text-center text-orange-500 animate-pulse font-bold tracking-wide">
          กำลังดึงข้อมูลโปรไฟล์ผู้ใช้งาน...
        </div>
      ) : (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-2xl">
          <div className="responsive-scroll">
            <table className="responsive-table w-full border-collapse border border-neutral-800 text-center">
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
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${getAccountRoleMeta(user.role)?.badgeClass || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
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
      {/* 🆕 POP-UP MODAL เพิ่มบัญชีผู้ใช้งาน */}
      {/* ========================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-2">
              <div>
                <h3 className="text-lg font-black text-white">➕ เพิ่มบัญชีผู้ใช้งาน</h3>
                <p className="mt-0.5 text-xs text-neutral-500">สร้างบัญชีใหม่พร้อมกำหนดบทบาทในระบบ</p>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="text-xl font-bold text-gray-500 transition-colors hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">Username *</label>
                  <input
                    type="text"
                    required
                    value={newUsernameInput}
                    onChange={(e) => setNewUsernameInput(e.target.value)}
                    placeholder="เช่น somchai"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-700 transition-colors focus:border-orange-550 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">Role *</label>
                  <div className="relative">
                    <select
                      value={newRoleInput}
                      onChange={(e) => setNewRoleInput(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white transition-colors focus:border-orange-550 focus:outline-none"
                    >
                      {ACCOUNT_ROLES.map((role) => (
                        <option key={role.value} value={role.value} className="bg-neutral-950 text-white">
                          {role.label.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-neutral-500">▼</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">อีเมล *</label>
                <input
                  type="email"
                  required
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-700 transition-colors focus:border-orange-550 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">ชื่อจริง / Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFullNameInput}
                  onChange={(e) => setNewFullNameInput(e.target.value)}
                  placeholder="กรอกชื่อ-นามสกุล..."
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-700 transition-colors focus:border-orange-550 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={newPhoneInput}
                  onChange={(e) => setNewPhoneInput(e.target.value)}
                  placeholder="เช่น 0891234567"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm text-white placeholder-neutral-700 transition-colors focus:border-orange-550 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">รหัสผ่าน *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    pattern={PASSWORD_PATTERN}
                    title={PASSWORD_REQUIREMENTS_TEXT}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="อย่างน้อย 8 ตัว มี A-Z, 0-9 และ @"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-700 transition-colors focus:border-orange-550 focus:outline-none"
                  />
                  <PasswordRequirements password={newPasswordInput} className="mt-2" />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">ยืนยันรหัสผ่าน *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    pattern={PASSWORD_PATTERN}
                    title={PASSWORD_REQUIREMENTS_TEXT}
                    value={newConfirmPasswordInput}
                    onChange={(e) => setNewConfirmPasswordInput(e.target.value)}
                    placeholder="กรอกรหัสผ่านซ้ำ"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-700 transition-colors focus:border-orange-550 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-800 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  disabled={createLoading}
                  className="rounded-lg bg-neutral-800 px-4 py-2 text-xs font-bold text-gray-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-black shadow-lg shadow-orange-500/10 transition-colors hover:bg-orange-600 disabled:bg-orange-800"
                >
                  {createLoading ? 'กำลังเพิ่มบัญชี...' : '✅ เพิ่มบัญชี'}
                </button>
              </div>
            </form>
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

          <div className={`max-h-[92vh] w-full max-w-md overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-2xl sm:p-6 ${isClosing ? 'animate-content-out' : 'animate-content-in'}`}>
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

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">บทบาท / Role</label>
                <div className="relative">
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white transition-colors focus:border-orange-550 focus:outline-none"
                  >
                    {ACCOUNT_ROLES.map((role) => (
                      <option key={role.value} value={role.value} className="bg-neutral-950 text-white">
                        {role.label.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-neutral-500">▼</span>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-4 border-t border-neutral-800 mt-6 sm:flex-row sm:justify-end">
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
