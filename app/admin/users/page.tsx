'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Users,
  Search,
  MoreVertical,
  Shield,
  User as UserIcon,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Ban,
  UserCheck,
  Star,
  ShoppingBag,
  DollarSign,
  Heart,
  Trash2,
  XCircle as XCircleIcon
} from 'lucide-react';
import Link from 'next/link';

interface Profile {
  id: string;
  username: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  extension_name: string | null;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
  role: 'customer' | 'admin' | 'staff';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login: string | null;
  date_of_birth: string | null;
  gender: string | null;
}

interface UserStats {
  totalOrders: number;
  totalSpent: number;
  reviewCount: number;
  wishlistCount: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedUsersForDelete, setSelectedUsersForDelete] = useState<string[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  
  const itemsPerPage = 10;

  useEffect(() => {
    // Get current admin user ID
    const getCurrentAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentAdminId(user.id);
      }
    };
    getCurrentAdmin();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Build query - EXCLUDE admin users from the list
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .neq('role', 'admin'); // Critical: exclude all admin users

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('is_active', statusFilter === 'active');
      }

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setUsers(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async (userId: string) => {
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('user_id', userId)
        .eq('payment_status', 'paid');

      if (ordersError) throw ordersError;

      const totalOrders = orders?.length || 0;
      const totalSpent = orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

      const { count: reviewCount, error: reviewError } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (reviewError) throw reviewError;

      const { count: wishlistCount, error: wishlistError } = await supabase
        .from('wishlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (wishlistError) throw wishlistError;

      setUserStats({
        totalOrders,
        totalSpent,
        reviewCount: reviewCount || 0,
        wishlistCount: wishlistCount || 0
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const handleViewUser = async (user: Profile) => {
    setSelectedUser(user);
    await fetchUserStats(user.id);
    setShowUserModal(true);
    setShowActionMenu(null);
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) {
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      
      alert(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      await fetchUsers();
      
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_active: !currentStatus } : null);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status');
    } finally {
      setUpdating(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      
      alert(`User role changed to ${newRole}`);
      await fetchUsers();
      
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole as any } : null);
      }
    } catch (error) {
      console.error('Error changing user role:', error);
      alert('Failed to change user role');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    // Prevent deleting current admin
    if (userId === currentAdminId) {
      alert("You cannot delete your own admin account!");
      return;
    }

    if (!confirm(`WARNING: You are about to permanently delete ${userName}. This action CANNOT be undone. All user data including orders, reviews, and wishlist items will be lost. Continue?`)) {
      return;
    }

    setDeleting(true);
    
    try {
      // Try to delete from Auth (this will fail if user doesn't exist in Auth)
      let authDeleted = false;
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (!authError) {
          authDeleted = true;
          console.log(`User ${userId} deleted from Auth`);
        }
        if (authError?.message?.includes('User not found')) {
          console.log(`User ${userId} not found in Auth, continuing with profile deletion`);
        }
      } catch (authErr: any) {
        console.log(`Auth deletion failed for ${userId}: ${authErr.message}`);
      }
      
      // Delete from profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (profileError) {
        console.error('Profile deletion error:', profileError);
        throw new Error(`Failed to delete from profiles: ${profileError.message}`);
      }
      
      // Delete related data
      try {
        await supabase.from('reviews').delete().eq('user_id', userId);
        await supabase.from('wishlists').delete().eq('user_id', userId);
        await supabase.from('addresses').delete().eq('user_id', userId);
        await supabase.from('notifications').delete().eq('user_id', userId);
        console.log(`Related data deleted for user ${userId}`);
      } catch (relatedError) {
        console.log('Error deleting related data (non-critical):', relatedError);
      }
      
      const message = authDeleted 
        ? `${userName} deleted successfully from Auth and Profiles`
        : `${userName} removed from profiles (Auth user didn't exist)`;
      
      alert(message);
      
      await fetchUsers();
      setSelectedUsersForDelete(prev => prev.filter(id => id !== userId));
      
      if (selectedUser && selectedUser.id === userId) {
        setShowUserModal(false);
        setSelectedUser(null);
      }
      
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`Failed to delete user: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsersForDelete.length === 0) {
      alert('Please select users to delete');
      return;
    }
    
    // Check if trying to delete current admin
    if (selectedUsersForDelete.includes(currentAdminId || '')) {
      alert("You cannot delete your own admin account! Please remove it from the selection.");
      return;
    }
    
    if (!confirm(`WARNING: You are about to permanently delete ${selectedUsersForDelete.length} selected user(s). This action CANNOT be undone. Continue?`)) {
      return;
    }
    
    setDeleting(true);
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[]
    };
    
    for (const userId of selectedUsersForDelete) {
      try {
        try {
          await supabase.auth.admin.deleteUser(userId);
        } catch (authErr: any) {
          console.log(`Auth user ${userId} not found, continuing with profile deletion`);
        }
        
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);
        
        if (profileError) throw new Error(profileError.message);
        
        await supabase.from('reviews').delete().eq('user_id', userId);
        await supabase.from('wishlists').delete().eq('user_id', userId);
        await supabase.from('addresses').delete().eq('user_id', userId);
        await supabase.from('notifications').delete().eq('user_id', userId);
        
        results.success.push(userId);
      } catch (error: any) {
        results.failed.push({ id: userId, error: error.message });
      }
    }
    
    let message = `Successfully deleted: ${results.success.length} users\n`;
    if (results.failed.length > 0) {
      message += `Failed: ${results.failed.length} users\n`;
      results.failed.slice(0, 3).forEach(f => {
        message += `  - ${f.id.slice(0, 8)}...: ${f.error}\n`;
      });
      if (results.failed.length > 3) {
        message += `  - and ${results.failed.length - 3} more...\n`;
      }
    }
    alert(message);
    
    setSelectedUsersForDelete([]);
    await fetchUsers();
    setDeleting(false);
  };

  const toggleUserSelection = (userId: string) => {
    // Prevent selecting admin user for deletion
    const user = users.find(u => u.id === userId);
    if (user?.role === 'admin') {
      alert("Admin users cannot be deleted from this panel");
      return;
    }
    setSelectedUsersForDelete(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    const selectableUsers = filteredUsers.filter(u => u.role !== 'admin');
    if (selectedUsersForDelete.length === selectableUsers.length && selectableUsers.length > 0) {
      setSelectedUsersForDelete([]);
    } else {
      setSelectedUsersForDelete(selectableUsers.map(u => u.id));
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'staff':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // User count display (excluding admins)
  const totalUsersCount = users.filter(u => u.role !== 'admin').length;
  const filteredCount = filteredUsers.filter(u => u.role !== 'admin').length;

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with User Count */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage customers and staff members ({totalUsersCount} total users)
          </p>
        </div>
      </div>

      {/* Bulk Delete Bar */}
      {selectedUsersForDelete.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedUsersForDelete.length === filteredUsers.filter(u => u.role !== 'admin').length && filteredUsers.filter(u => u.role !== 'admin').length > 0}
              onChange={selectAllUsers}
              className="rounded border-red-300"
            />
            <span className="text-sm text-red-700 font-medium">
              {selectedUsersForDelete.length} user(s) selected for deletion
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedUsersForDelete([])}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">All Roles</option>
              <option value="customer">Customers</option>
              <option value="staff">Staff</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    onChange={selectAllUsers}
                    checked={filteredUsers.filter(u => u.role !== 'admin').length > 0 && 
                            selectedUsersForDelete.length === filteredUsers.filter(u => u.role !== 'admin').length}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsersForDelete.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      disabled={user.role === 'admin'}
                      className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                   </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.first_name} className="h-full w-full object-cover" />
                        ) : (
                          <UserIcon className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                          {user.extension_name && ` ${user.extension_name}`}
                        </p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                   </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </div>
                      {user.phone_number && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Phone className="h-3 w-3" />
                          {user.phone_number}
                        </div>
                      )}
                    </div>
                   </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                   </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {user.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                      {user.is_verified && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          Verified
                        </span>
                      )}
                    </div>
                   </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(user.created_at)}
                   </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(user.last_login)}
                   </td>
                  <td className="px-6 py-4 text-right relative">
                    <div className="flex items-center justify-end gap-2">
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.id, `${user.first_name} ${user.last_name}`)}
                          disabled={deleting || user.id === currentAdminId}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setShowActionMenu(showActionMenu === user.id ? null : user.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="h-5 w-5 text-gray-500" />
                      </button>
                    </div>
                    
                    {showActionMenu === user.id && (
                      <div className="absolute right-6 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <div className="py-1">
                          <button
                            onClick={() => handleViewUser(user)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </button>
                          {user.role !== 'admin' && (
                            <>
                              <button
                                onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                {user.is_active ? (
                                  <>
                                    <Ban className="h-4 w-4" />
                                    Deactivate User
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    Activate User
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleChangeRole(user.id, user.role === 'customer' ? 'staff' : 'customer')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Shield className="h-4 w-4" />
                                Make {user.role === 'customer' ? 'Staff' : 'Customer'}
                              </button>
                              <hr className="my-1 border-gray-100" />
                              <button
                                onClick={() => handleDeleteUser(user.id, `${user.first_name} ${user.last_name}`)}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete User
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                   </td>
                  </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>No users found</p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="mt-2 text-sm text-black hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages} ({totalUsersCount} total users)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal - Same as before but with admin restrictions */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">User Details</h2>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {/* User Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={selectedUser.first_name} className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-10 w-10 text-gray-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedUser.first_name} {selectedUser.last_name}
                    {selectedUser.extension_name && ` ${selectedUser.extension_name}`}
                  </h3>
                  <p className="text-gray-500">@{selectedUser.username}</p>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(selectedUser.role)}`}>
                      {selectedUser.role}
                    </span>
                    {selectedUser.is_active ? (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
                    ) : (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">Inactive</span>
                    )}
                  </div>
                </div>
              </div>

              {/* User Stats */}
              {userStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <ShoppingBag className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{userStats.totalOrders}</p>
                    <p className="text-xs text-gray-500">Total Orders</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <DollarSign className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{formatPrice(userStats.totalSpent)}</p>
                    <p className="text-xs text-gray-500">Total Spent</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <Star className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{userStats.reviewCount}</p>
                    <p className="text-xs text-gray-500">Reviews</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <Heart className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{userStats.wishlistCount}</p>
                    <p className="text-xs text-gray-500">Wishlist Items</p>
                  </div>
                </div>
              )}

              {/* User Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Full Name</p>
                    <p className="text-sm font-medium">
                      {selectedUser.first_name} {selectedUser.middle_name && `${selectedUser.middle_name} `}{selectedUser.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email Address</p>
                    <p className="text-sm">{selectedUser.email}</p>
                  </div>
                  {selectedUser.phone_number && (
                    <div>
                      <p className="text-xs text-gray-500">Phone Number</p>
                      <p className="text-sm">{selectedUser.phone_number}</p>
                    </div>
                  )}
                  {selectedUser.date_of_birth && (
                    <div>
                      <p className="text-xs text-gray-500">Date of Birth</p>
                      <p className="text-sm">{formatDate(selectedUser.date_of_birth)}</p>
                    </div>
                  )}
                  {selectedUser.gender && (
                    <div>
                      <p className="text-xs text-gray-500">Gender</p>
                      <p className="text-sm">{selectedUser.gender}</p>
                    </div>
                  )}
                </div>

                <h4 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 mt-4">Account Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">User ID</p>
                    <p className="text-sm font-mono text-xs break-all">{selectedUser.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Username</p>
                    <p className="text-sm">@{selectedUser.username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Member Since</p>
                    <p className="text-sm">{formatDateTime(selectedUser.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last Login</p>
                    <p className="text-sm">{formatDateTime(selectedUser.last_login)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email Verified</p>
                    <p className="text-sm">
                      {selectedUser.is_verified ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions - Hide for admin users */}
              {selectedUser.role !== 'admin' && (
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                  <Link
                    href={`/admin/users/${selectedUser.id}/orders`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition-colors"
                  >
                    View Orders
                  </Link>
                  <button
                    onClick={() => handleToggleUserStatus(selectedUser.id, selectedUser.is_active)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {selectedUser.is_active ? 'Deactivate User' : 'Activate User'}
                  </button>
                  <button
                    onClick={() => handleChangeRole(selectedUser.id, selectedUser.role === 'customer' ? 'staff' : 'customer')}
                    className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Make {selectedUser.role === 'customer' ? 'Staff' : 'Customer'}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(selectedUser.id, `${selectedUser.first_name} ${selectedUser.last_name}`)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete User
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
