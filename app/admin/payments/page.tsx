// app/admin/payments/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logAdminActivity } from '@/lib/admin-activity'
import {
  CreditCard,
  Search,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Wallet,
  RefreshCw,
  PhilippinePeso,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  DollarSign
} from 'lucide-react'

interface Payment {
  id: number
  order_id: number
  payment_provider: string
  transaction_id: string
  amount: number
  payment_status: string
  paid_at: string | null
  created_at: string
}

interface OrderWithDetails {
  id: number
  payment_method: string
  total_amount: number
  payment_status: string
  order_status: string
  user_id: string
}

interface Profile {
  first_name: string
  last_name: string
  email: string
}

interface EnrichedPayment extends Payment {
  order?: OrderWithDetails | null
  customer?: Profile | null
}

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

const ITEMS_PER_PAGE = 10

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<EnrichedPayment[]>([])
  const [orderBackedRevenue, setOrderBackedRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPayment, setSelectedPayment] = useState<EnrichedPayment | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingPaymentId, setUpdatingPaymentId] = useState<number | null>(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Staff authentication required')
      }

      const response = await fetch('/api/admin/payments', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch payments')
      }

      setPayments(result.payments || [])
      setOrderBackedRevenue(Number(result.totalRevenue || 0))
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments()
    
    const subscription = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => {
          fetchPayments()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchPayments])

  // ============================================
  // COMPLETELY REWRITTEN updatePaymentStatus with detailed error logging
  // ============================================
 const updatePaymentStatus = async (paymentId: number, newStatus: PaymentStatus, orderId?: number) => {
  setUpdatingPaymentId(paymentId)
  setUpdatingStatus(true)

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Staff authentication required')
    }

    const response = await fetch('/api/admin/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ paymentId, newStatus, orderId }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update payment status')
    }

    await logAdminActivity({
      action: 'UPDATE_PAYMENT_STATUS',
      target_type: 'payment',
      target_id: paymentId,
      details: { payment_status: newStatus, order_id: orderId },
    })

    await fetchPayments()

    if (selectedPayment && selectedPayment.id === paymentId) {
      setSelectedPayment({
        ...selectedPayment,
        payment_status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : selectedPayment.paid_at
      })
    }

    alert(`Payment marked as ${newStatus.toUpperCase()} successfully!`)
    return

    console.log('=== UPDATE PAYMENT STATUS START ===')
    console.log('Payment ID:', paymentId)
    console.log('New Status:', newStatus)
    console.log('Order ID:', orderId)

    // Step 1: Update payment status
    const updateData: Record<string, string> = { payment_status: newStatus }
    if (newStatus === 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()

    if (paymentError) {
      console.error('Payment update error:', paymentError)
      throw new Error(`Payment update failed: ${paymentError.message}`)
    }

    console.log('Payment updated successfully')

    // Step 2: If payment is marked as paid, update order
    if (newStatus === 'paid' && orderId) {
      console.log('Updating order status for order ID:', orderId)
      
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          payment_status: 'paid',
          order_status: 'processing'
        })
        .eq('id', orderId)

      if (orderError) {
        console.error('Order update error:', orderError)
        throw new Error(`Order update failed: ${orderError.message}`)
      }

      console.log('Order updated successfully')

      // Step 3: Add to order status history - MATCHING YOUR SCHEMA EXACTLY
      console.log('Adding to order_status_history...')
      
      // Only include columns that exist in your schema
      const historyData = {
        order_id: orderId,
        status: 'processing',
        notes: 'Payment confirmed, order is now processing'
        // created_at is omitted - let database handle it (default now())
      }
      
      console.log('Attempting to insert history data:', historyData)
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('Admin authentication required')
        }

        const historyResponse = await fetch('/api/admin/payment-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'log-status-history',
            historyData,
          }),
        })

        const historyResult = await historyResponse.json()

        if (!historyResponse.ok) {
          console.error('Status history API error:', historyResult)
        } else {
          console.log('Status history added successfully:', historyResult)
        }
      } catch (historyErr) {
        console.error('Status history API failed:', historyErr)
      }

      // Step 4: Add notification
      try {
        const { data: orderData, error: orderFetchError } = await supabase
          .from('orders')
          .select('user_id')
          .eq('id', orderId)
          .single()

        if (orderFetchError) {
          console.error('Order fetch error:', orderFetchError)
        } else if (orderData) {
          const notificationData = {
            user_id: orderData.user_id,
            title: 'Payment Confirmed',
            message: `Your payment for order #${orderId} has been confirmed. Your order is now being processed.`,
            is_read: false
          }
          
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.access_token) {
            throw new Error('Admin authentication required')
          }

          const notifResponse = await fetch('/api/admin/payment-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: 'create-notification',
              notificationData: {
                ...notificationData,
                type: 'general',
                created_at: new Date().toISOString(),
              },
            }),
          })

          const notifResult = await notifResponse.json()

          if (!notifResponse.ok) {
            console.error('Notification API error:', notifResult)
          } else {
            console.log('Notification created successfully')
          }
        }
      } catch (notifErr) {
        console.error('Notification creation failed:', notifErr)
      }
    }

    // Step 5: If payment is marked as failed
    if (newStatus === 'failed' && orderId) {
      console.log('Processing failed payment...')
      
      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('user_id')
          .eq('id', orderId)
          .single()

        if (orderData) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            const response = await fetch('/api/admin/payment-status', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'create-notification',
                notificationData: {
                  user_id: orderData.user_id,
                  title: 'Payment Failed',
                  message: `Your payment for order #${orderId} has failed. Please try again or contact support.`,
                  is_read: false,
                  type: 'general',
                  created_at: new Date().toISOString(),
                },
              }),
            })

            const result = await response.json()
            if (!response.ok) {
              console.error('Failed notification API error:', result)
            }
          }
        }
      } catch (notifErr) {
        console.error('Failed notification error:', notifErr)
      }
    }

    // Step 6: Refresh data
    await logAdminActivity({
      action: 'UPDATE_PAYMENT_STATUS',
      target_type: 'payment',
      target_id: paymentId,
      details: { payment_status: newStatus, order_id: orderId },
    })

    // Step 6: Refresh data
    await fetchPayments()
    
    // Step 7: Update selected payment if modal is open
    if (selectedPayment && selectedPayment.id === paymentId) {
      setSelectedPayment({
        ...selectedPayment,
        payment_status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : selectedPayment.paid_at
      })
    }

    console.log('=== UPDATE PAYMENT STATUS COMPLETED SUCCESSFULLY ===')
    alert(`Payment marked as ${newStatus.toUpperCase()} successfully!`)

  } catch (error) {
    console.error('=== UPDATE PAYMENT STATUS FAILED ===')
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error message:', message)
    alert(`Failed to update payment status: ${message}`)
  } finally {
    setUpdatingPaymentId(null)
    setUpdatingStatus(false)
  }
}

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesSearch =
        payment.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.payment_provider?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.customer?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.customer?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.order_id?.toString().includes(searchTerm)

      const matchesStatus =
        statusFilter === 'all' ||
        payment.payment_status.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [payments, searchTerm, statusFilter])

  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE)

  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const totalRevenue = orderBackedRevenue

  const paidCount = payments.filter(
    (p) => p.payment_status === 'paid'
  ).length

  const pendingCount = payments.filter(
    (p) => p.payment_status === 'pending'
  ).length

  const failedCount = payments.filter(
    (p) => p.payment_status === 'failed'
  ).length

  const refundedCount = payments.filter(
    (p) => p.payment_status === 'refunded'
  ).length

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-700'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      case 'refunded':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'failed':
        return <XCircle className="h-4 w-4" />
      case 'refunded':
        return <DollarSign className="h-4 w-4" />
      default:
        return <Wallet className="h-4 w-4" />
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-12 w-12 animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Payments Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor and update customer payment transactions
          </p>
        </div>

        <button
          onClick={fetchPayments}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <h2 className="text-2xl font-bold mt-1">
                ₱{totalRevenue.toLocaleString()}
              </h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-black text-white flex items-center justify-center">
              <PhilippinePeso className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Paid</p>
              <h2 className="text-2xl font-bold mt-1">{paidCount}</h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <h2 className="text-2xl font-bold mt-1">{pendingCount}</h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <h2 className="text-2xl font-bold mt-1">{failedCount}</h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <XCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Refunded</p>
              <h2 className="text-2xl font-bold mt-1">{refundedCount}</h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by transaction ID, order ID, customer..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setCurrentPage(1)
          }}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Transaction
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Customer
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Provider
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Amount
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Date
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-500">
                    <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    No payments found
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {payment.transaction_id ? `#${payment.transaction_id.slice(0, 12)}...` : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Order #{payment.order_id}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {payment.customer
                            ? `${payment.customer.first_name} ${payment.customer.last_name}`
                            : 'Unknown User'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payment.customer?.email || 'No email'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-sm font-medium">
                        {payment.payment_provider || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900">
                        ₱{Number(payment.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusBadge(payment.payment_status)}`}>
                          {getStatusIcon(payment.payment_status)}
                          {payment.payment_status}
                        </div>
                        {payment.payment_status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePaymentStatus(payment.id, 'paid', payment.order_id)}
                              disabled={updatingPaymentId === payment.id}
                              className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                            >
                              {updatingPaymentId === payment.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              Mark Paid
                            </button>
                            <button
                              onClick={() => updatePaymentStatus(payment.id, 'failed', payment.order_id)}
                              disabled={updatingPaymentId === payment.id}
                              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                            >
                              <XCircle className="h-3 w-3" />
                              Mark Failed
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(payment.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setSelectedPayment(payment)}
                          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredPayments.length)} of {filteredPayments.length} payments
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="h-10 w-10 border border-gray-200 rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-gray-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="px-4 py-2 text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="h-10 w-10 border border-gray-200 rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-gray-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Transaction ID: {selectedPayment.transaction_id || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="h-10 w-10 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              >
                X
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Status Update Section */}
              {selectedPayment.payment_status === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Update Payment Status
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => updatePaymentStatus(selectedPayment.id, 'paid', selectedPayment.order_id)}
                      disabled={updatingStatus}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Approve Payment
                    </button>
                    <button
                      onClick={() => updatePaymentStatus(selectedPayment.id, 'failed', selectedPayment.order_id)}
                      disabled={updatingStatus}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      <XCircle className="h-4 w-4" />
                      Mark Failed
                    </button>
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-semibold mt-1">
                    {selectedPayment.customer
                      ? `${selectedPayment.customer.first_name} ${selectedPayment.customer.last_name}`
                      : 'Unknown'}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-semibold mt-1 break-all">
                    {selectedPayment.customer?.email || 'N/A'}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Payment Provider</p>
                  <p className="font-semibold mt-1 capitalize">
                    {selectedPayment.payment_provider || 'Unknown'}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <p className="font-semibold mt-1 capitalize">
                    {selectedPayment.order?.payment_method || 'N/A'}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="font-bold text-xl mt-1">
                    ₱{Number(selectedPayment.amount).toLocaleString()}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Status</p>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mt-2 ${getStatusBadge(selectedPayment.payment_status)}`}>
                    {getStatusIcon(selectedPayment.payment_status)}
                    {selectedPayment.payment_status}
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Full Transaction ID</p>
                <p className="font-mono text-sm mt-2 break-all">
                  {selectedPayment.transaction_id || 'N/A'}
                </p>
              </div>

              {/* Order Information */}
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Order Information</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order ID</span>
                    <span className="font-medium">#{selectedPayment.order_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order Status</span>
                    <span className="font-medium capitalize">
                      {selectedPayment.order?.order_status || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order Total</span>
                    <span className="font-medium">
                      ₱{Number(selectedPayment.order?.total_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Created</span>
                    <span className="font-medium">{formatDate(selectedPayment.created_at)}</span>
                  </div>
                  {selectedPayment.paid_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paid At</span>
                      <span className="font-medium">{formatDate(selectedPayment.paid_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
