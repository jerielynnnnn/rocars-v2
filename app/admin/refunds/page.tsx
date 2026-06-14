'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTimePH } from '@/lib/time';
import {
  RefreshCw,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';

interface Refund {
  id: number;
  order_id: number;
  user_id: string;
  reason: string;
  refund_status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_response: string | null;
  created_at: string;
  order?: {
    id: number;
    total_amount: number;
    order_status: string;
    payment_method: string;
    created_at: string;
  };
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  
  const itemsPerPage = 10;

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Admin authentication required');
      }

      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(itemsPerPage),
        status: statusFilter,
      });

      const response = await fetch(`/api/admin/refunds?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load refunds');
      }

      setRefunds((result.refunds || []) as Refund[]);
      setTotalPages(Math.max(1, Math.ceil((result.total || 0) / itemsPerPage)));
    } catch (error) {
      console.error('Error fetching refunds:', error);
      alert(error instanceof Error ? error.message : 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRefunds();
  }, [fetchRefunds]);

  const handleUpdateRefundStatus = async (refundId: number, newStatus: string, response?: string) => {
    if (!confirm(`Are you sure you want to ${newStatus} this refund request?`)) {
      return;
    }

    setProcessingAction(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Admin authentication required');
      }

      const apiResponse = await fetch('/api/admin/refunds', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          refundId,
          status: newStatus,
          adminResponse: response || null,
        }),
      });
      const result = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(result.error || 'Failed to update refund status');
      }

      alert(`Refund ${newStatus} successfully`);
      await fetchRefunds();
      setShowRefundModal(false);
      setAdminResponse('');
    } catch (error) {
      console.error('Error updating refund:', error);
      alert(error instanceof Error ? error.message : 'Failed to update refund status');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleViewRefund = (refund: Refund) => {
    setSelectedRefund(refund);
    setAdminResponse(refund.admin_response || '');
    setShowRefundModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Approved' };
      case 'rejected':
        return { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Rejected' };
      case 'completed':
        return { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, text: 'Completed' };
      default:
        return { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Pending' };
    }
  };

  const formatDate = (dateString: string) => {
    return formatDateTimePH(dateString);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const getSubmittedProblem = (reason: string) => {
    const proofMatch = reason.match(/\n\n\[PROOFS:(.+)\]$/s);
    const cleanReason = proofMatch ? reason.replace(proofMatch[0], '').trim() : reason;
    let proofs: string[] = [];

    if (proofMatch) {
      try {
        const parsedProofs = JSON.parse(proofMatch[1]);
        proofs = Array.isArray(parsedProofs)
          ? parsedProofs.filter((url): url is string => typeof url === 'string')
          : [];
      } catch {
        proofs = [];
      }
    }

    const [rawType, ...detailsParts] = cleanReason.split(':');
    const details = detailsParts.join(':').trim();

    return {
      type: rawType?.trim() || 'Problem report',
      details: details || cleanReason,
      proofs,
    };
  };

  const isVideoProof = (url: string) => {
    return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
  };

  const filteredRefunds = refunds.filter(refund =>
    refund.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    refund.order?.id.toString().includes(searchTerm) ||
    refund.user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    refund.user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    refund.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && refunds.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Refund Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage customer refund and cancellation requests
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Requests</p>
              <p className="text-2xl font-bold text-yellow-600">
                {refunds.filter(r => r.refund_status === 'pending').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {refunds.filter(r => r.refund_status === 'approved').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-2xl font-bold text-red-600">
                {refunds.filter(r => r.refund_status === 'rejected').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Refund Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(refunds.reduce((sum, r) => 
                  r.refund_status === 'approved' ? sum + (r.order?.total_amount || 0) : sum, 0
                ))}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Submitted Problems */}
      {refunds.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Submitted Problems</h2>
              <p className="text-sm text-gray-500">Customer reports from delivered orders that need refund review</p>
            </div>
            <span className="text-sm font-medium text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full">
              {refunds.filter((refund) => refund.refund_status === 'pending').length} pending
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {refunds
              .filter((refund) => refund.refund_status === 'pending')
              .slice(0, 4)
              .map((refund) => {
                const problem = getSubmittedProblem(refund.reason);

                return (
                  <button
                    key={refund.id}
                    onClick={() => handleViewRefund(refund)}
                    className="text-left rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {problem.type}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Order #{refund.order_id} · {refund.user?.email || 'Customer'}
                        </p>
                      </div>
                      <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full">
                        Pending
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {problem.details}
                    </p>
                  </button>
                );
              })}
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
              placeholder="Search by order ID, customer name, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Refunds Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Request ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted Problem</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRefunds.map((refund) => {
                const StatusBadge = getStatusBadge(refund.refund_status);
                const StatusIcon = StatusBadge.icon;
                return (
                  <tr key={refund.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm">#{refund.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/admin/orders/${refund.order_id}`} className="font-mono text-sm text-blue-600 hover:underline">
                        #{refund.order_id}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {refund.user?.first_name} {refund.user?.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{refund.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">
                        {formatPrice(refund.order?.total_amount || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const problem = getSubmittedProblem(refund.reason);

                        return (
                          <div className="max-w-xs">
                            <p className="text-sm font-medium text-gray-700 truncate">{problem.type}</p>
                        <p className="text-xs text-gray-500 truncate">{problem.details}</p>
                        {problem.proofs.length > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            {problem.proofs.length} proof file{problem.proofs.length === 1 ? '' : 's'} attached
                          </p>
                        )}
                      </div>
                    );
                  })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${StatusBadge.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {StatusBadge.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(refund.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleViewRefund(refund)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Eye className="h-5 w-5 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRefunds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>No refund requests found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refund Details Modal */}
      {showRefundModal && selectedRefund && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Refund Request Details</h2>
              <button
                onClick={() => setShowRefundModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Request ID</p>
                  <p className="text-sm font-mono font-medium">#{selectedRefund.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date Submitted</p>
                  <p className="text-sm">{formatDate(selectedRefund.created_at)}</p>
                </div>
              </div>

              {/* Order Info */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Order Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Order ID:</span>
                    <Link href={`/admin/orders/${selectedRefund.order_id}`} className="text-sm font-mono text-blue-600 hover:underline">
                      #{selectedRefund.order_id}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Order Amount:</span>
                    <span className="text-sm font-semibold">{formatPrice(selectedRefund.order?.total_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Payment Method:</span>
                    <span className="text-sm">{selectedRefund.order?.payment_method || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Order Date:</span>
                    <span className="text-sm">{formatDate(selectedRefund.order?.created_at || '')}</span>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Name:</span>
                    <span className="text-sm">{selectedRefund.user?.first_name} {selectedRefund.user?.last_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm">{selectedRefund.user?.email}</span>
                  </div>
                </div>
              </div>

              {/* Submitted Problem */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Submitted Problem</h3>
                <div className="bg-yellow-50 rounded-lg p-4">
                  {(() => {
                    const problem = getSubmittedProblem(selectedRefund.reason);

                    return (
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-yellow-700">Problem Type</p>
                          <p className="text-sm font-semibold text-gray-900">{problem.type}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-yellow-700">Customer Details</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">{problem.details}</p>
                        </div>
                        {problem.proofs.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-yellow-700">Proof Attachments</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                              {problem.proofs.map((url, index) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block overflow-hidden rounded-lg border border-yellow-200 bg-white"
                                >
                                  {isVideoProof(url) ? (
                                    <video
                                      src={url}
                                      className="h-36 w-full object-cover"
                                      controls
                                    />
                                  ) : (
                                    <img
                                      src={url}
                                      alt={`Refund proof ${index + 1}`}
                                      className="h-36 w-full object-cover"
                                    />
                                  )}
                                  <p className="px-3 py-2 text-xs text-blue-600">Open proof #{index + 1}</p>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Admin Response */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Admin Response</h3>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Add your response to the customer..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Actions */}
              {selectedRefund.refund_status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleUpdateRefundStatus(selectedRefund.id, 'rejected', adminResponse)}
                    disabled={processingAction}
                    className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Reject Refund
                  </button>
                  <button
                    onClick={() => handleUpdateRefundStatus(selectedRefund.id, 'approved', adminResponse)}
                    disabled={processingAction}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Approve Refund
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
