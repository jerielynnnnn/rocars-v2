// app/admin/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { canAccessAdminPath, isAdminLikeRole, STAFF_DEFAULT_ADMIN_PATH } from '@/lib/admin-role';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Protect admin routes
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Check if user has admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!isAdminLikeRole(profile?.role)) {
        router.push('/');
        return;
      }

      if (!canAccessAdminPath(profile?.role, pathname || '/admin/dashboard')) {
        router.push(profile?.role === 'admin' ? '/admin/dashboard' : STAFF_DEFAULT_ADMIN_PATH);
      }
    };

    checkAdmin();
  }, [pathname, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar is already included from the main Navbar component */}
      <main className="pt-20">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
