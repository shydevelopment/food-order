import React from 'react';

interface ActivityLogItemProps {
  act: {
    id: string;
    title: string;
    detail: string;
    icon: string;
    colorClass: string;
    timestamp: Date | null;
  };
}

export function ActivityLogItem({ act }: ActivityLogItemProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return 'ไม่ระบุวันที่';
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '-';
    return (
      date.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' น.'
    );
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'ไม่ระบุเวลา';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // ป้องกันเวลาอนาคต หรือน้อยกว่า 1 นาที
    if (diffInSeconds < 60) {
      return 'เมื่อสักครู่';
    }

    const minutes = Math.floor(diffInSeconds / 60);
    if (minutes < 60) {
      return `${minutes} นาทีที่แล้ว`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} ชั่วโมงที่แล้ว`;
    }

    const days = Math.floor(hours / 24);
    if (days === 1) {
      return 'เมื่อวานนี้';
    }
    if (days < 7) {
      return `${days} วันที่แล้ว`;
    }

    const weeks = Math.floor(days / 7);
    if (weeks < 4) {
      return `${weeks} สัปดาห์ที่แล้ว`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
      return `${months} เดือนที่แล้ว`;
    }

    const years = Math.floor(days / 365);
    return `${years} ปีที่แล้ว`;
  };

  return (
    <div className="p-4 bg-neutral-950/70 border border-neutral-800/80 rounded-xl flex items-center justify-between gap-4 hover:bg-neutral-800/40 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border shrink-0 ${act.colorClass}`}>
          {act.icon}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-white truncate">{act.title}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{act.detail}</p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-orange-400 font-mono">
          📅 {formatDate(act.timestamp)}
        </div>

        <div className="text-xs text-gray-400 font-mono mt-0.5">
          {formatTime(act.timestamp)}{' '}
          <span className="text-gray-500">({formatTimeAgo(act.timestamp)})</span>
        </div>
      </div>
    </div>
  );
}