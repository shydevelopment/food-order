'use client'

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { usePathname } from 'next/navigation'; 

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const pathname = usePathname(); 

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        await fetchProfile(user.id);
      } else {
        setProfile(null); 
      }
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]); 

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        // จุดแก้ไขที่ 1: เพิ่มคอลัมน์ role เข้าไปใน select
        .select('username, full_name, avatar_url, role') 
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) setProfile(data);
    } catch (error: any) {
      console.error('Error fetching profile:', error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return <header className="bg-black text-gray-300 p-4 border-b border-neutral-900">กำลังโหลด...</header>;
  }

  // จุดแก้ไขที่ 2: เช็คแอดมินจาก role ที่ดึงมาจาก Database โดยตรง
  const isAdmin = profile?.role === 'admin';

  return (
    <header className="bg-black text-white shadow-md w-full relative z-50 border-b border-neutral-900">
      <div className="w-full px-6 py-3 flex justify-between items-center">

        <div className="text-xl font-black cursor-pointer text-orange-500 tracking-wide" onClick={() => window.location.href = '/'}>
          FOOD <span className="text-white">ORDER</span> KMUTNB 🍔
        </div>

        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <a href="/" className={`transition-colors ${pathname === '/' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}>
            Home
          </a>
          <a href="/storePage" className={`transition-colors ${pathname === '/menus' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}>
            Restaurant
          </a>
          <a href="/promotionPage" className={`transition-colors ${pathname === '/promotions' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}>
            Promotions
          </a>
          {user && (
            <a href="/trackorderPage" className={`transition-colors ${pathname === '/orders' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}>
              Track Order
            </a>
          )}

          {user && isAdmin && (
            <a href="/admin" className="text-red-400 hover:text-red-500 font-bold border border-red-900/50 px-2.5 py-0.5 rounded bg-red-950/20 transition-all text-xs tracking-wide">
              📊 Admin
            </a>
          )}
        </nav>

        <div className="flex items-center space-x-6">
          
          {user && (
            <a href="/cartPage" className="relative text-gray-300 hover:text-orange-500 transition-colors p-1 group">
              <svg className="w-6 h-6 group-hover:scale-105 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-black text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-black animate-pulse">
                2
              </span>
            </a>
          )}

          {user ? (
            <div className="relative">

              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center space-x-3 hover:text-orange-500 transition focus:outline-none cursor-pointer group"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border border-orange-500 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm font-bold text-black">
                    {(profile?.full_name || profile?.username || user.email)?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="text-sm hidden sm:block text-left">
                  <span className="block font-medium group-hover:text-orange-400 transition-colors">
                    {profile?.full_name || profile?.username || user.email}
                  </span>
                </div>

                <svg className="w-4 h-4 text-gray-500 group-hover:text-orange-500 transition-colors hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>

                  <div className="absolute right-0 mt-2 w-56 bg-neutral-900 text-gray-200 rounded-lg shadow-2xl border border-neutral-800 py-1 z-20">
                    <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950 rounded-t-lg">
                      <p className="text-[10px] text-gray-500 font-bold tracking-wider uppercase mb-1">Your Account</p>
                      
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm font-bold text-orange-500 truncate">
                          @{profile?.username || profile?.full_name || 'username'}
                        </p>
                        {/* จุดแก้ไขที่ 3: ป้าย Badge แสดง Role */}
                        {profile?.role && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide
                            ${profile.role === 'admin' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 
                              profile.role === 'restaurant' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/50' : 
                              profile.role === 'rider' ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 
                              'bg-gray-500/20 text-gray-400 border border-gray-500/50'}`}
                          >
                            {profile.role}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 truncate mt-1">
                        {user?.email}
                      </p>
                    </div>

                    <a
                      href="/viewProfile"
                      className="block px-4 py-2 text-sm hover:bg-neutral-800 hover:text-orange-400 transition-colors mt-1"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      👤 View Profile
                    </a>

                    <a
                      href="/editPage"
                      className="block px-4 py-2 text-sm hover:bg-neutral-800 hover:text-orange-400 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      ⚙️ Edit Profile
                    </a>

                    <hr className="border-neutral-800 my-1" />

                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950/30 font-medium transition-colors cursor-pointer"
                    >
                      🚪 Log Out
                    </button>
                  </div>
                </>
              )}

            </div>
          ) : (
            <div className="space-x-3">
              <a href="/login" className="text-gray-300 hover:text-orange-400 text-sm transition-colors">
                Login
              </a>
              <a href="/register" className="bg-orange-500 hover:bg-orange-600 text-black font-bold text-sm px-4 py-2 rounded-md transition shadow-md shadow-orange-500/10">
                Create Account
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}