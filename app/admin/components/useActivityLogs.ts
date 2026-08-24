import { useCallback, useEffect, useState } from 'react';

export interface ActivityLog {
  id: string;
  type: 'order' | 'user' | 'restaurant' | 'menu';
  restaurantId: string | null;
  restaurantName: string | null;
  title: string;
  detail: string;
  icon: string;
  colorClass: string;
  timestamp: Date | null;
}

export interface ActivityRestaurant {
  id: string;
  name: string;
}

export function useActivityLogs(restaurantId = '') {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [restaurants, setRestaurants] = useState<ActivityRestaurant[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const parseSafeDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const fetchActivityLogs = useCallback(async () => {
    setLoading(true);
    try {
      const search = new URLSearchParams();
      if (restaurantId) search.set('restaurantId', restaurantId);

      const res = await fetch(`/api/admin/activity-logs${search.toString() ? `?${search.toString()}` : ''}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถโหลดประวัติกิจกรรมได้');
      }

      setRole(result.role || null);
      setRestaurants(result.restaurants || []);
      setActivities((result.activities || []).map((activity: Omit<ActivityLog, 'timestamp'> & { timestamp: string | null }) => ({
        ...activity,
        timestamp: parseSafeDate(activity.timestamp),
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถโหลดประวัติกิจกรรมได้';
      console.error('Error fetching activity logs:', message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  return { activities, restaurants, role, loading, refetch: fetchActivityLogs };
}
