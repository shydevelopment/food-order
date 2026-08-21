'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { canHaveRestaurantAccess } from '@/lib/roles';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface Restaurant {
  id: string;
  name: string;
  owner_id: string | null;
}

interface RestaurantMember {
  id: string;
  restaurant_id: string;
  user_id: string;
  access_level: 'owner' | 'staff';
  created_at: string;
}

interface SearchableOption {
  value: string;
  label: string;
  detail?: string;
}

function SearchableSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  invalid = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) => {
    const searchText = `${option.label} ${option.detail || ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  });

  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-neutral-400">{label}</label>
      <div
        className="relative"
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
      >
        <input
          type="text"
          disabled={disabled}
          value={isOpen ? query : selectedOption?.label || ''}
          onFocus={() => {
            setQuery('');
            setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-neutral-950 px-3 py-2 pr-9 text-sm text-white placeholder-neutral-600 focus:outline-none disabled:cursor-not-allowed disabled:text-neutral-600 ${
            invalid
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-neutral-800 focus:border-orange-500'
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery('');
            setIsOpen((current) => !current);
          }}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-xs text-neutral-500 disabled:cursor-not-allowed"
          aria-label={`เปิดรายการ${label}`}
        >
          ▼
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 shadow-2xl">
            {value && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange('');
                  setQuery('');
                  setIsOpen(false);
                }}
                className="block w-full border-b border-neutral-800 px-3 py-2 text-left text-xs font-bold text-neutral-500 hover:bg-neutral-900 hover:text-white"
              >
                ล้างตัวเลือก
              </button>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left transition hover:bg-neutral-900 ${
                    option.value === value ? 'bg-orange-500/10 text-orange-400' : 'text-white'
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  {option.detail && <span className="mt-0.5 block text-xs text-neutral-500">{option.detail}</span>}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">ไม่พบข้อมูลที่ค้นหา</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RestaurantAccessPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [members, setMembers] = useState<RestaurantMember[]>([]);
  const [restaurantInput, setRestaurantInput] = useState('');
  const [userInput, setUserInput] = useState('');
  const [accessLevelInput, setAccessLevelInput] = useState<'owner' | 'staff'>('staff');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

  const fetchAccessData = useCallback(async () => {
    setLoading(true);
    setSetupMessage(null);

    try {
      const res = await fetch('/api/admin/restaurant-access');
      const result = await res.json();

      if (!res.ok) {
        if (result.setupRequired) {
          setSetupMessage(result.message || 'ต้องสร้างตาราง restaurant_members ก่อนใช้งานหน้านี้');
        }
        throw new Error(result.error || 'ไม่สามารถโหลดข้อมูลสิทธิ์ร้านอาหารได้');
      }

      setProfiles(result.profiles || []);
      setRestaurants(result.restaurants || []);
      setMembers(result.members || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลสิทธิ์ร้านอาหารได้';
      console.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAccessData();
  }, [fetchAccessData]);

  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const restaurantsById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants]
  );

  const selectedProfile = profilesById.get(userInput);
  const selectedProfileCanAccessRestaurant = canHaveRestaurantAccess(selectedProfile?.role);
  const canAssignAccess = Boolean(restaurantInput && userInput && selectedProfileCanAccessRestaurant);
  const restaurantOptions = useMemo(
    () => restaurants.map((restaurant) => ({
      value: restaurant.id,
      label: restaurant.name,
      detail: restaurant.owner_id ? `owner_id: ${restaurant.owner_id.slice(0, 8)}` : 'ยังไม่มี owner_id',
    })),
    [restaurants]
  );
  const userOptions = useMemo(
    () => profiles.map((profile) => ({
      value: profile.id,
      label: profile.full_name || profile.username || profile.email || profile.id,
      detail: `${profile.email || 'ไม่มีอีเมล'} • role: ${profile.role || 'user'}`,
    })),
    [profiles]
  );

  const filteredMembers = members.filter((member) => {
    const restaurant = restaurantsById.get(member.restaurant_id);
    const profile = profilesById.get(member.user_id);
    const query = searchTerm.toLowerCase();

    return (
      restaurant?.name?.toLowerCase().includes(query) ||
      profile?.full_name?.toLowerCase().includes(query) ||
      profile?.username?.toLowerCase().includes(query) ||
      profile?.email?.toLowerCase().includes(query) ||
      member.access_level.includes(query)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!restaurantInput || !userInput) {
      alert('กรุณาเลือกร้านอาหารและผู้ใช้งานก่อน');
      return;
    }

    if (!selectedProfileCanAccessRestaurant) {
      alert('ผู้ใช้นี้ต้องเป็น role RESTAURANT หรือ ADMIN ก่อน แล้วค่อยให้สิทธิ์ร้านอาหาร');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/admin/restaurant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurantInput,
          userId: userInput,
          accessLevel: accessLevelInput,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถบันทึกสิทธิ์ร้านอาหารได้');
      }

      alert('บันทึกสิทธิ์ร้านอาหารสำเร็จ');
      setUserInput('');
      setAccessLevelInput('staff');
      await fetchAccessData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์ร้านอาหาร';
      alert('เกิดข้อผิดพลาด: ' + message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (member: RestaurantMember) => {
    const restaurant = restaurantsById.get(member.restaurant_id);
    const profile = profilesById.get(member.user_id);

    if (!confirm(`ต้องการลบสิทธิ์ ${profile?.full_name || profile?.username || 'ผู้ใช้นี้'} จากร้าน ${restaurant?.name || 'นี้'} ใช่ไหม?`)) {
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/admin/restaurant-access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถลบสิทธิ์ร้านอาหารได้');
      }

      await fetchAccessData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบสิทธิ์ร้านอาหาร';
      alert('เกิดข้อผิดพลาด: ' + message);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-500">Restaurant Access</p>
          <h1 className="mt-2 text-2xl font-black text-white">จัดสิทธิ์เข้าถึงร้านอาหาร</h1>
          <p className="mt-1 text-sm text-neutral-400">
            เลือกผู้ใช้ role RESTAURANT หรือ ADMIN แล้วกำหนดเป็นเจ้าของร้านหรือพนักงานประจำร้าน
          </p>
        </div>

        <div className="relative w-full lg:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-neutral-500">🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาร้าน, ผู้ใช้, อีเมล..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2 pl-9 pr-4 text-xs text-white placeholder-neutral-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {setupMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {setupMessage}
          <div className="mt-1 text-xs text-red-200/80">
            เปิดไฟล์ supabase/sql/restaurant_members.sql แล้วรันใน Supabase SQL Editor ก่อน
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_180px_auto] xl:items-end">
          <div>
            <SearchableSelect
              label="ร้านอาหาร"
              placeholder="พิมพ์ชื่อร้านเพื่อค้นหา..."
              value={restaurantInput}
              options={restaurantOptions}
              onChange={setRestaurantInput}
            />
          </div>

          <div>
            <SearchableSelect
              label="ผู้ใช้งาน"
              placeholder="พิมพ์ชื่อ, username หรืออีเมล..."
              value={userInput}
              options={userOptions}
              onChange={setUserInput}
              invalid={Boolean(selectedProfile && !selectedProfileCanAccessRestaurant)}
            />
            {selectedProfile && !selectedProfileCanAccessRestaurant && (
              <p className="mt-1 text-xs font-bold text-red-400">
                ล็อก: ต้องตั้ง role เป็น RESTAURANT หรือ ADMIN ก่อน ถึงจะให้สิทธิ์ร้านได้
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-neutral-400">ระดับสิทธิ์</label>
            <div className="relative">
              <select
                value={accessLevelInput}
                onChange={(e) => setAccessLevelInput(e.target.value as 'owner' | 'staff')}
                disabled={Boolean(selectedProfile && !selectedProfileCanAccessRestaurant)}
                className="w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 pr-8 text-sm text-white disabled:cursor-not-allowed disabled:text-neutral-600 focus:border-orange-500 focus:outline-none"
              >
                <option value="staff">พนักงานร้าน</option>
                <option value="owner">เจ้าของร้าน</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-neutral-500">▼</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canAssignAccess || submitLoading || loading}
            className="rounded-lg bg-orange-500 px-5 py-2 text-xs font-black uppercase tracking-wide text-black transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {submitLoading ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        <div className="responsive-scroll">
          <table className="responsive-table w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950 text-xs uppercase tracking-wide text-neutral-400">
                <th className="border-r border-neutral-800 p-4">ร้านอาหาร</th>
                <th className="border-r border-neutral-800 p-4">ผู้ใช้งาน</th>
                <th className="border-r border-neutral-800 p-4">ระดับสิทธิ์</th>
                <th className="p-4">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-orange-500">กำลังโหลดสิทธิ์ร้านอาหาร...</td>
                </tr>
              ) : filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  const restaurant = restaurantsById.get(member.restaurant_id);
                  const profile = profilesById.get(member.user_id);

                  return (
                    <tr key={member.id} className="transition hover:bg-neutral-800/45">
                      <td className="border-r border-neutral-800 p-4 font-bold text-white">
                        {restaurant?.name || 'ไม่พบร้าน'}
                      </td>
                      <td className="border-r border-neutral-800 p-4">
                        <div className="font-bold text-white">{profile?.full_name || profile?.username || 'ไม่พบผู้ใช้'}</div>
                        <div className="mt-0.5 text-xs text-neutral-500">{profile?.email || '-'}</div>
                      </td>
                      <td className="border-r border-neutral-800 p-4">
                        <span className={`inline-block rounded border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                          member.access_level === 'owner'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                            : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                        }`}>
                          {member.access_level === 'owner' ? 'OWNER' : 'STAFF'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          disabled={submitLoading}
                          onClick={() => handleDelete(member)}
                          className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          ลบสิทธิ์
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-neutral-500">
                    ยังไม่มีการกำหนดสิทธิ์ร้านอาหาร
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
