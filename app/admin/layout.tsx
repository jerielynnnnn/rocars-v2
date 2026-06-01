// app/admin/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

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

      if (profile?.role !== 'admin') {
        router.push('/');
      }
    };

    checkAdmin();
  }, [router]);

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