"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ACCOUNT_ROLES, getAccountRoleMeta } from '@/lib/roles';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string | null;
  email: string | null;
}

export default function ManageRolesPage() {
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

  // ⚡ State สำหรับระบบ Popup Modal (เพิ่มสเตตตอนปิดเพิ่มเข้ามา)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // เช็คว่ากำลังเล่นอนิเมชันปิดอยู่ไหม
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [roleInput, setRoleInput] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true });

    if (profileError) {
      alert('ไม่สามารถดึงข้อมูล role ได้: ' + profileError.message);
    }

    if (profileData) setProfiles(profileData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleOpenEditModal = (user: Profile) => {
    setSelectedUser(user);
    setRoleInput(user.role || '');
    setIsModalOpen(true);
  };

  // ⚡ ฟังก์ชันปิดมอดอลแบบหน่วงเวลาเพื่อรอให้อนิเมชันเฟดออกแสดงผลจนจบ
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsClosing(false);
      setSelectedUser(null);
    }, 200); // ดีเลย์ 200ms เท่ากับเวลาอนิเมชันใน CSS
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !roleInput) return;

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/admin/update-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: roleInput,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถเปลี่ยน role ได้');
      }

      alert('💾 เปลี่ยนบทบาทผู้ใช้งานสำเร็จ!');
      await fetchData();
      handleCloseModal(); // ใช้ฟังก์ชันปิดแบบสมูท
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเปลี่ยน role';
      alert('เกิดข้อผิดพลาด: ' + message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const getRoleBadgeStyle = (role: string | null) => {
    return getAccountRoleMeta(role)?.badgeClass || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
  };

  const filteredProfiles = profiles.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.phone?.includes(searchLower)
    );
  });

  return (
    <div className="relative p-1">
      {/* ส่วนหัวของหน้าจอ */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wide">
            👥 จัดการบทบาทผู้ใช้งาน
          </h2>
          <p className="text-sm text-gray-400">
            Role หลักมี Customer, Student, Restaurant และ Admin ส่วน Owner/Staff ของร้านให้จัดในหน้า สิทธิ์ร้านอาหาร
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
          กำลังดึงข้อมูลระบบบทบาท...
        </div>
      ) : (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-2xl">
          <div className="responsive-scroll">
            <table className="responsive-table w-full text-center border-collapse border border-neutral-800">
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
                            alt={user.username || 'avatar'}
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
                      {user.email || <span className="text-neutral-600 font-normal italic">ไม่มีข้อมูล</span>}
                    </td>
                    <td className="p-4 font-mono text-gray-400 border-r border-neutral-800 text-center">
                      {user.phone || <span className="text-neutral-600 font-normal italic">ไม่มีข้อมูล</span>}
                    </td>
                    <td className="p-4 text-center border-r border-neutral-800">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${getRoleBadgeStyle(user.role)}`}>
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(user)}
                          className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-550/10 hover:bg-blue-550/20 px-6 py-1.5 rounded border border-blue-500/20 focus:outline-none text-center font-sans uppercase tracking-wide inline-flex items-center gap-2"
                        >
                          {user.role || 'เปลี่ยน ROLE'}
                          <span className="text-blue-400/60 text-[9px]">▼</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProfiles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-gray-500">
                      ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ⚡ POP-UP MODAL (เปิดสมูทพุ่งขึ้น - ปิดสมูทเฟดลงครบสูตร) */}
      {/* ========================================== */}
      {(isModalOpen || isClosing) && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}>
          
          {/* 🛠️ ส่วนฝังการตั้งค่าอนิเมชัน ทั้งจังหวะเข้า (In) และจังหวะออก (Out) */}
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
            
            {/* หัว Modal */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800">
              <h3 className="text-lg font-black text-white">⚙️ เปลี่ยนบทบาทผู้ใช้งาน</h3>
              <button 
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-white transition-colors text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveChanges} className="space-y-4">
              {/* รายละเอียดผู้ใช้งานย่อ */}
              <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800/60 space-y-1">
                <p className="text-xs text-neutral-400"><span className="text-neutral-500 font-bold">ชื่อจริง:</span> {selectedUser?.full_name || 'ไม่ได้ระบุ'}</p>
                <p className="text-xs text-neutral-400"><span className="text-neutral-500 font-bold">Username:</span> @{selectedUser?.username}</p>
                <p className="text-xs text-neutral-400"><span className="text-neutral-500 font-bold">อีเมล:</span> {selectedUser?.email || 'ไม่มีข้อมูล'}</p>
              </div>

              {/* Dropdown เลือกบทบาท */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">เลือกบทบาทใหม่ / New Role</label>
                <div className="mb-2 grid gap-2">
                  {ACCOUNT_ROLES.map((role) => (
                    <div key={role.value} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${role.badgeClass}`}>
                          {role.label}
                        </span>
                        <span className="text-xs font-bold text-neutral-300">{role.thaiLabel}</span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{role.description}</p>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-550 transition-colors appearance-none cursor-pointer"
                    >
                    <option value="" disabled className="text-neutral-600">-- กรุณาเลือกบทบาท --</option>
                    {ACCOUNT_ROLES.map((r) => (
                      <option key={r.value} value={r.value} className="text-white bg-neutral-950">
                        {r.label.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-500 text-xs">▼</span>
                </div>
              </div>

              {/* ปุ่มควบคุม */}
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
                  {submitLoading ? 'กำลังบันทึก...' : '💾 ยืนยันเปลี่ยน Role'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
