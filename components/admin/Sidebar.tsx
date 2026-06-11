'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  RefreshCw,
  Star,
  Tags,
  Settings,
  LogOut,
  Truck,
  Shield,
  ChevronLeft,
  ChevronRight,
  Gift,
  Bell
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { canAccessAdminPath, getRoleModules, isStaffRole, STAFF_DEFAULT_ADMIN_PATH } from '@/lib/admin-role';

const navItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
  { name: 'Payments', href: '/admin/payments', icon: CreditCard },
  { name: 'Refunds', href: '/admin/refunds', icon: RefreshCw },
  { name: 'Reviews', href: '/admin/reviews', icon: Star },
  { name: 'Categories', href: '/admin/categories', icon: Tags },
  { name: 'Vouchers', href: '/admin/vouchers', icon: Gift },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell },
  { name: 'Shipping', href: '/admin/shipping', icon: Truck },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('admin-sidebar-collapsed') === 'true';
  });
  const [userRole, setUserRole] = useState<string>('admin');

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const loadRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role) {
        setUserRole(profile.role);
      }
    };

    loadRole();
  }, []);

  // Save collapsed state to localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('admin-sidebar-collapsed', String(newState));
  };

  const visibleNavItems = navItems.filter((item) => canAccessAdminPath(userRole, item.href));
  const roleModules = getRoleModules(userRole);
  const isLimitedStaff = isStaffRole(userRole);
  const adminHomeHref = isLimitedStaff ? STAFF_DEFAULT_ADMIN_PATH : '/admin/dashboard';

  const handleLogout = async () => {
    try {
      localStorage.removeItem('cart');
      localStorage.removeItem('checkoutSummary');
      localStorage.removeItem('userOrders');
      localStorage.removeItem('userAddresses');
      localStorage.removeItem('pendingGcashOrder');
      localStorage.removeItem('currentPaymentIntentId');
      localStorage.removeItem('gcashReferenceNumber');

      await supabase.auth.signOut();

      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  };

  return (
    <>
      {/* Mobile overlay when sidebar is open on small screens */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
      
      <div 
        className={`
          fixed lg:relative z-50 bg-black text-white flex flex-col h-full border-r border-yellow-500/20 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
        `}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className={`
            absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full 
            bg-yellow-400 text-black border border-black/20 shadow-lg
            hover:bg-yellow-500 transition-all duration-200
          `}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>

        {/* Logo Section */}
        <div className={`p-4 border-b border-yellow-500/20 ${isCollapsed ? 'px-2' : ''}`}>
          <Link href={adminHomeHref} className="flex items-center gap-3 group">
            <img src="/logo.png" alt="ROCARS" className="w-10 h-10 object-contain" />
            {!isCollapsed && (
              <div>
                <h1 className="text-white font-bold text-sm tracking-wide">ROCARS</h1>
                <p className="text-[8px] text-yellow-400 uppercase tracking-[0.25em]">ADMIN</p>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-2">
            {visibleNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname?.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                    ${isCollapsed ? 'justify-center' : ''}
                    ${
                      isActive
                        ? 'bg-yellow-400/10 text-yellow-400'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon
                    className={`w-5 h-5 transition-colors flex-shrink-0 ${
                      isActive
                        ? 'text-yellow-400'
                        : 'text-gray-500 group-hover:text-white'
                    }`}
                  />
                  
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {isActive && (
                        <div className="w-1 h-1 rounded-full bg-yellow-400" />
                      )}
                    </>
                  )}
                  
                  {isCollapsed && isActive && (
                    <div className="absolute left-0 w-1 h-8 bg-yellow-400 rounded-r-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Admin Access Card - Hide when collapsed */}
          {!isCollapsed && (
            <div className="mt-6 mx-4 p-3 rounded-xl bg-gradient-to-br from-yellow-400/5 to-yellow-400/10 border border-yellow-400/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3 h-3 text-yellow-400" />
                <p className="text-xs font-medium text-yellow-400">
                  Admin Access
                </p>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {isLimitedStaff
                  ? `${roleModules.join(', ')} access enabled.`
                  : 'Full administrative privileges enabled.'}
              </p>
            </div>
          )}
          
          {/* Collapsed version - Just icon */}
          {isCollapsed && (
            <div className="mt-6 mx-2 p-2 rounded-xl bg-gradient-to-br from-yellow-400/5 to-yellow-400/10 border border-yellow-400/20 flex justify-center">
              <Shield className="w-4 h-4 text-yellow-400" />
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className={`p-4 border-t border-yellow-500/20 ${isCollapsed ? 'px-2' : ''}`}>
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 px-3 py-3 text-red-400 hover:bg-red-500/10 rounded-xl 
              w-full text-sm font-medium transition-all group
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? 'Log Out' : undefined}
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:scale-110 flex-shrink-0" />
            {!isCollapsed && <span>Log Out</span>}
          </button>

          {!isCollapsed && (
            <div className="mt-4 text-center">
              <p className="text-[10px] text-gray-600">v1.0</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
