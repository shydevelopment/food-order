'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { usePathname } from 'next/navigation'; 
import Link from 'next/link';

interface Profile {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const pathname = usePathname(); 

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url, role') 
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) setProfile(data as Profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching profile:', message);
    }
  }, [supabase]);

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
  }, [fetchProfile, pathname, supabase]); 

  useEffect(() => {
    const syncCartCount = () => {
      try {
        const cart = JSON.parse(window.localStorage.getItem('food-order-cart') || '[]') as Array<{ quantity?: number }>;
        setCartCount(cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
      } catch {
        setCartCount(0);
      }
    };

    syncCartCount();
    window.addEventListener('storage', syncCartCount);
    window.addEventListener('food-order-cart-updated', syncCartCount);

    return () => {
      window.removeEventListener('storage', syncCartCount);
      window.removeEventListener('food-order-cart-updated', syncCartCount);
    };
  }, [pathname]);

  const handleLogout = async () => {
    const shouldLogout = window.confirm('ต้องการออกจากระบบใช่ไหม?');
    if (!shouldLogout) return;

    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return <header className="bg-black text-gray-300 p-4 border-b border-neutral-900">กำลังโหลด...</header>;
  }

  const isAdmin = profile?.role === 'admin';
  const isRestaurantOwner = profile?.role === 'restaurant';

  return (
    <header className="bg-black text-white shadow-md w-full relative z-50 border-b border-neutral-900">
      <div className="w-full px-4 sm:px-6 py-3 flex justify-between items-center relative z-20 bg-black">

        {/* LOGO */}
        <div 
          className="text-lg sm:text-xl font-black cursor-pointer text-orange-500 tracking-wide transition-transform active:scale-95" 
          onClick={() => window.location.href = '/'}
        >
          FOOD <span className="text-white">ORDER</span> KMUTNB 🍔
        </div>

        {/* DESKTOP NAVIGATION */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <Link href="/" className={`transition-all active:scale-90 ${pathname === '/' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}>
            Home
          </Link>

          <a href="/storePage" className={`transition-all active:scale-90 ${pathname === '/storePage' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}>
            Restaurant
          </a>

          {user && (
            <a href="/trackorderPage" className={`transition-all active:scale-90 ${pathname === '/trackorderPage' ? 'text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`}>
              Track Order
            </a>
          )}

          {(isAdmin || isRestaurantOwner) && (
            <a href={isAdmin ? '/admin' : '/admin/orders'} className="text-red-400 hover:text-red-500 font-bold border border-red-900/50 px-2.5 py-0.5 rounded bg-red-950/20 transition-all active:scale-90 active:bg-red-900/50 text-xs tracking-wide">
              {isAdmin ? '📊 Admin' : '🧾 ร้านค้า'}
            </a>
          )}
        </nav>

        {/* RIGHT SECTION */}
        <div className="flex items-center space-x-3 sm:space-x-6">
          
          {/* CART ICON */}
          {user && (
            <a href="/cartPage" className="relative text-gray-300 hover:text-orange-500 transition-all active:scale-75 p-1 group">
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-black text-[10px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center border border-black animate-pulse">
                  {cartCount}
                </span>
              )}
            </a>
          )}

          {/* USER PROFILE / LOGIN BUTTONS (Desktop) */}
          {user ? (
            <div className="relative hidden md:block">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center space-x-3 hover:text-orange-500 transition-all active:scale-95 focus:outline-none cursor-pointer group"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full border border-orange-500 object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm font-bold text-black">
                    {(profile?.full_name || profile?.username || user.email)?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-sm text-left">
                  <span className="block font-medium group-hover:text-orange-400 transition-colors">
                    {profile?.full_name || profile?.username || user.email}
                  </span>
                </div>
                <svg className={`w-4 h-4 text-gray-500 group-hover:text-orange-500 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <p className="text-sm font-bold text-orange-500 truncate">@{profile?.username || profile?.full_name || 'username'}</p>
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
                      <p className="text-xs text-gray-400 truncate mt-1">{user?.email}</p>
                    </div>

                    <a href="/viewProfile" className="block px-4 py-2 text-sm hover:bg-neutral-800 hover:text-orange-400 transition-colors active:bg-neutral-700 mt-1" onClick={() => setIsMenuOpen(false)}>
                      👤 View Profile
                    </a>
                    <a href="/editPage" className="block px-4 py-2 text-sm hover:bg-neutral-800 hover:text-orange-400 transition-colors active:bg-neutral-700" onClick={() => setIsMenuOpen(false)}>
                      ⚙️ Edit Profile
                    </a>
                    <hr className="border-neutral-800 my-1" />
                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950/30 font-medium transition-colors active:bg-red-900/50 cursor-pointer">
                      🚪 Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ถ้ายังไม่ได้ Login แสดงปุ่ม Login / Register บนคอม */
            <div className="hidden md:flex space-x-3">
              <a href="/login" className="text-gray-300 hover:text-orange-400 text-sm transition-all active:scale-95 flex items-center">
                Login
              </a>
              <a href="/register" className="bg-orange-500 hover:bg-orange-600 text-black font-bold text-sm px-4 py-2 rounded-md transition-all active:scale-95 shadow-md shadow-orange-500/10">
                Create Account
              </a>
            </div>
          )}

          {/* HAMBURGER BUTTON */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden relative w-8 h-8 text-gray-300 hover:text-orange-500 focus:outline-none transition-all active:scale-75 duration-300"
            aria-label="Toggle Menu"
          >
            <svg 
              className={`absolute top-0.5 left-0.5 w-7 h-7 transition-all duration-300 transform ${isMobileMenuOpen ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100'}`} 
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            
            <svg 
              className={`absolute top-0.5 left-0.5 w-7 h-7 text-orange-500 transition-all duration-300 transform ${isMobileMenuOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'}`} 
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

        </div>
      </div>

      {/* 📌 MOBILE DRAWER / MENU */}
      <div 
        className={`md:hidden grid transition-[grid-template-rows,opacity] duration-300 ease-in-out absolute w-full left-0 bg-neutral-950 z-10 shadow-2xl ${
          isMobileMenuOpen ? 'grid-rows-[1fr] opacity-100 border-b border-neutral-900' : 'grid-rows-[0fr] opacity-0 border-transparent'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-6 py-5 border-t border-neutral-900">
            
            {user ? (
              /* กรณี Login แล้ว: แสดงโปรไฟล์ + เมนูนำทาง + บัญชีผู้ใช้ */
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-neutral-900 rounded-xl border border-neutral-800 mb-2 transition-transform active:scale-[0.98]">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full border border-orange-500 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold text-black text-lg">
                      {(profile?.full_name || profile?.username || user.email)?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{profile?.full_name || profile?.username || user.email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-orange-400 truncate">@{profile?.username || 'user'}</span>
                      {profile?.role && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">
                          {profile.role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <nav className="flex flex-col space-y-3 font-medium text-base">
                  <Link href="/" className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`} onClick={() => setIsMobileMenuOpen(false)}>
                    🏠 Home
                  </Link>
                  <a href="/storePage" className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/storePage' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`} onClick={() => setIsMobileMenuOpen(false)}>
                    🍔 Restaurant
                  </a>
                  <a href="/trackorderPage" className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/trackorderPage' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`} onClick={() => setIsMobileMenuOpen(false)}>
                    📍 Track Order
                  </a>
                  {(isAdmin || isRestaurantOwner) && (
                    <a href={isAdmin ? '/admin' : '/admin/orders'} className="p-2 rounded-lg text-red-400 bg-red-950/30 border border-red-900/50 font-bold flex items-center gap-2 transition-all active:scale-95 active:bg-red-900/50" onClick={() => setIsMobileMenuOpen(false)}>
                      {isAdmin ? '📊 Admin Dashboard' : '🧾 รับออเดอร์ร้านค้า'}
                    </a>
                  )}
                </nav>

                <hr className="border-neutral-900 my-2" />

                <div className="space-y-2 pt-1">
                  <a href="/viewProfile" className="block p-2 rounded-lg text-sm text-gray-300 hover:bg-neutral-900 hover:text-orange-400 transition-all active:scale-95 active:bg-neutral-800" onClick={() => setIsMobileMenuOpen(false)}>
                    👤 View Profile
                  </a>
                  <a href="/editPage" className="block p-2 rounded-lg text-sm text-gray-300 hover:bg-neutral-900 hover:text-orange-400 transition-all active:scale-95 active:bg-neutral-800" onClick={() => setIsMobileMenuOpen(false)}>
                    ⚙️ Edit Profile
                  </a>
                  <button onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} className="w-full text-left p-2 rounded-lg text-sm font-bold text-red-400 bg-red-950/20 hover:bg-red-900/40 transition-all active:scale-95 active:bg-red-900/60">
                    🚪 Log Out
                  </button>
                </div>
              </div>
            ) : (
              /* กรณี "ยังไม่ Login": เปิดให้ดูเว็บและร้านอาหารได้ แต่ยังไม่ให้สั่งอาหาร */
              <div className="flex flex-col space-y-3">
                <Link href="/" className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`} onClick={() => setIsMobileMenuOpen(false)}>
                  🏠 Home
                </Link>
                <a href="/storePage" className={`p-2 rounded-lg transition-all active:scale-95 active:bg-orange-500/20 ${pathname === '/storePage' ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-gray-300 hover:text-orange-400'}`} onClick={() => setIsMobileMenuOpen(false)}>
                  🍔 Restaurant
                </a>
                <hr className="border-neutral-900 my-1" />
                <a 
                  href="/login" 
                  className="w-full text-center py-2.5 text-gray-300 hover:text-orange-400 text-sm font-semibold rounded-lg border border-neutral-800 transition-all active:scale-95 active:bg-neutral-900" 
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Login
                </a>
                <a 
                  href="/register" 
                  className="w-full text-center py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-bold text-sm rounded-lg transition-all active:scale-95 active:bg-orange-700 shadow-md shadow-orange-500/10" 
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Create Account
                </a>
              </div>
            )}

          </div>
        </div>
      </div>
    </header>
  );
}
