'use client';

import React, { useState } from 'react';
import { useActivityLogs } from '../components/useActivityLogs';
import { ActivityLogItem } from '../components/ActivityLogItem';

export default function AdminActivityLogsPage() {
  const { activities, loading, refetch } = useActivityLogs();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'order' | 'user' | 'restaurant' | 'menu'>('all');

  // ฟังก์ชันกรองข้อมูล
  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      act.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.detail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || act.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="relative p-2 space-y-6">
      {/* หัวข้อหน้า */}
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
          onClick={refetch}
          className="self-start md:self-auto bg-orange-500 hover:bg-orange-600 text-black px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 active:scale-95 cursor-pointer"
        >
          <span>🔄</span> รีเฟรชประวัติ
        </button>
      </div>

      {/* แถบค้นหาและตัวกรอง */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="ค้นหากิจกรรม, สมาชิก, ออร์เดอร์, ชื่อร้าน หรือเมนู..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 overflow-x-auto">
          {(['all', 'order', 'user', 'restaurant', 'menu'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterType === type ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {type === 'all' && `ทั้งหมด (${activities.length})`}
              {type === 'order' && '🛒 ออร์เดอร์'}
              {type === 'user' && '👤 สมาชิก'}
              {type === 'restaurant' && '🏪 ร้านค้า'}
              {type === 'menu' && '🍽️ เมนูอาหาร'}
            </button>
          ))}
        </div>
      </div>

      {/* รายการแสดงผล */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl">
        {loading ? (
          <div className="py-20 text-center text-sm text-orange-500 animate-pulse font-bold">
            กำลังโหลดประวัติกิจกรรมทั้งหมด...
          </div>
        ) : filteredActivities.length > 0 ? (
          <div className="space-y-3">
            {filteredActivities.map((act) => (
              <ActivityLogItem key={act.id} act={act} />
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