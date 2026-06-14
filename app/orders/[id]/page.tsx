'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { formatDatePH, formatTimePH } from '@/lib/time';
import { 
  Package, Truck, CheckCircle, Clock, MapPin, 
  Calendar, ArrowLeft, RefreshCw, Star, AlertCircle,
  XCircle, Loader2, Home, Paperclip
} from 'lucide-react';

interface ProductImage {
  image_url: string;
}

interface Product {
  id: number;
  name: string;
  brand: string;
  product_images: ProductImage[];
}

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  price: number;
  products: Product;
}

interface Address {
  id: number;
  recipient_first_name: string;
  recipient_last_name: string;
  street_address: string;
  barangay: string;
  city: string;
  province: string;
  zip_code: string;
  phone_number: string;
}

interface StatusHistory {
  id: number;
  status: string;
  notes: string;
  created_at: string;
}

interface Refund {
  id: number;
  reason: string;
  refund_status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_response: string | null;
  created_at: string;
}

interface Order {
  id: number;
  order_status: string;
  payment_status: string;
  subtotal: number;
  shipping_fee: number;
  total_amount: number;
  payment_method: string;
  notes: string;
  created_at: string;
  tracking_number: string;
  estimated_delivery_date: string;
  delivered_at: string;
  cancelled_at: string;
  order_items: OrderItem[];
  addresses: Address;
  order_status_history: StatusHistory[];
  refunds: Refund[];
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong';
}

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReasonType, setRefundReasonType] = useState('damaged_item');
  const [refundReason, setRefundReason] = useState('');
  const [refundProofFiles, setRefundProofFiles] = useState<File[]>([]);
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            quantity,
            price,
            products (
              id,
              name,
              brand,
              product_images (image_url)
            )
          ),
          addresses!orders_address_id_fkey (*),
          order_status_history (*),
          refunds (*)
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (err: unknown) {
      console.error('Error fetching order:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrder();
  }, [fetchOrder]);

  const uploadRefundProofs = async (accessToken: string) => {
    const proofUrls: string[] = [];

    for (const file of refundProofFiles) {
      const formData = new FormData();
      formData.append('orderId', orderId);
      formData.append('file', file);

      const response = await fetch('/api/refunds/proofs', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to upload ${file.name}`);
      }

      if (result.proof?.url) {
        proofUrls.push(result.proof.url);
      }
    }

    return proofUrls;
  };

  const handleRequestRefund = async () => {
    if (!refundReason.trim()) return;
    
    setSubmittingRefund(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.push('/login');
        return;
      }
      
      const proofUrls = await uploadRefundProofs(session.access_token);
      const response = await fetch('/api/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId: parseInt(orderId),
          reasonType: refundReasonType,
          details: refundReason,
          proofUrls,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit refund request');
      }
      
      alert('Refund request submitted successfully!');
      setShowRefundModal(false);
      setRefundReasonType('damaged_item');
      setRefundReason('');
      setRefundProofFiles([]);
      fetchOrder();
    } catch (err: unknown) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) return;
    
    setSubmittingRating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.rpc('rate_order', {
        p_order_id: parseInt(orderId),
        p_user_id: user?.id,
        p_rating: rating,
        p_comment: ratingComment || null
      });

      if (error) throw error;

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const productReviewResponse = await fetch(`/api/orders/${orderId}/product-reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rating,
          comment: ratingComment,
        }),
      });
      const productReviewResult = await productReviewResponse.json();

      if (!productReviewResponse.ok) {
        throw new Error(productReviewResult.error || 'Failed to publish product reviews');
      }
      
      alert('Thank you for your rating!');
      setShowRatingModal(false);
      setRating(0);
      setRatingComment('');
    } catch (err: unknown) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setSubmittingRating(false);
    }
  };

  const statusSteps = [
    { key: 'order_placed', label: 'Order Placed', icon: Package, timeText: 'Order Placed' },
    { key: 'pending', label: 'Pending', icon: Clock, timeText: 'Pending' },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle, timeText: 'Confirmed' },
    { key: 'processing', label: 'Processing', icon: Package, timeText: 'Processing' },
    { key: 'shipped', label: 'Shipped', icon: Truck, timeText: 'Shipped' },
    { key: 'delivered', label: 'Delivered', icon: MapPin, timeText: 'Delivered' }
  ];

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const index = statusSteps.findIndex(step => step.key === order.order_status);
    return index === -1 ? 0 : index;
  };

  const getStatusDescription = (statusKey: string) => {
    const descriptions: Record<string, string> = {
      order_placed: `Your order #${order?.id} was placed for delivery.`,
      pending: 'Your order is pending for confirmation. Will be confirmed within 5 minutes.',
      confirmed: 'Your order is confirmed. Will deliver soon.',
      processing: 'Your order is being processed and prepared for shipment.',
      shipped: 'Your order has been shipped and is on its way.',
      delivered: 'Your order has been delivered successfully.'
    };
    return descriptions[statusKey] || '';
  };

  const getStatusTime = (statusKey: string) => {
    if (!order) return '';
    const historyItem = order.order_status_history?.find(h => h.status === statusKey);
    if (historyItem) {
      return formatTimePH(historyItem.created_at);
    }
    if (statusKey === 'order_placed') {
      return formatTimePH(order.created_at);
    }
    return '';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return formatDatePH(dateString);
  };

  const canRequestRefund = () => {
    if (!order) return false;
    const activeRefund = order.refunds?.find(refund =>
      ['pending', 'approved'].includes(refund.refund_status)
    );
    return order.order_status === 'delivered'
      && order.payment_status === 'paid'
      && !activeRefund;
  };

  const canRate = () => {
    if (!order) return false;
    return order.order_status === 'delivered';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pt-20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pt-20">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
          <p className="text-gray-500 mb-6">{error || 'Order does not exist or you do not have permission to view it.'}</p>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const latestRefund = order.refunds
    ? [...order.refunds].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
    : null;

  return (
    <div className="min-h-screen bg-[#f8f9fa] pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        {/* Order Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-500">Order #</span>
                <span className="font-mono font-bold text-lg">{order.id}</span>
              </div>
              <p className="text-gray-500 text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Placed on {formatDate(order.created_at)}
              </p>
              {order.tracking_number && (
                <p className="text-sm text-blue-600 mt-2 font-mono">
                  Tracking: {order.tracking_number}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                order.order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                order.order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {order.order_status?.toUpperCase().replace('_', ' ') || 'PENDING'}
              </span>
              {order.estimated_delivery_date && order.order_status !== 'delivered' && (
                <p className="text-xs text-gray-500 mt-2">
                  Est. Delivery: {formatDatePH(order.estimated_delivery_date)}
                </p>
              )}
              {order.delivered_at && (
                <p className="text-xs text-green-600 mt-2">
                  Delivered: {formatDatePH(order.delivered_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Status Timeline - Like your image */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-6">Order Status</h2>
          <div className="relative">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const statusTime = getStatusTime(step.key);
              const Icon = step.icon;
              
              return (
                <div key={step.key} className="relative flex items-start mb-8 last:mb-0">
                  {/* Connector Line */}
                  {index < statusSteps.length - 1 && (
                    <div className={`absolute left-5 top-10 w-0.5 h-12 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                  
                  {/* Icon Circle */}
                  <div className={`z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-green-200' : ''}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  {/* Content */}
                  <div className="ml-4 flex-1">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <h3 className={`font-semibold ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                          {step.label}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {getStatusDescription(step.key)}
                        </p>
                      </div>
                      {statusTime && (
                        <p className="text-sm text-gray-500 font-mono">{statusTime}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Order Items</h2>
          <div className="space-y-4">
            {order.order_items?.map((item: OrderItem) => (
              <div key={item.id} className="flex gap-4 py-3 border-b border-gray-100 last:border-0">
                <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                  <img
                    src={item.products?.product_images?.[0]?.image_url || '/placeholder-product.jpg'}
                    alt={item.products?.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-product.jpg';
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-black">{item.products?.name}</h3>
                  <p className="text-sm text-gray-500">{item.products?.brand}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                    <span className="font-semibold">{formatPrice(item.price)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping Fee</span>
                <span>{order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee)}</span>
              </div>
              {order.notes && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Notes</span>
                  <span className="text-gray-500">{order.notes}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-xl text-yellow-600">{formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        {order.addresses && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-600" />
              Shipping Address
            </h2>
            <div className="space-y-1">
              <p className="font-medium text-black">
                {order.addresses.recipient_first_name} {order.addresses.recipient_last_name}
              </p>
              <p className="text-gray-600 text-sm">{order.addresses.street_address}</p>
              <p className="text-gray-600 text-sm">
                {order.addresses.barangay}, {order.addresses.city}
              </p>
              <p className="text-gray-600 text-sm">
                {order.addresses.province} {order.addresses.zip_code}
              </p>
              <p className="text-gray-600 text-sm">{order.addresses.phone_number}</p>
            </div>
          </div>
        )}

        {/* Payment Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Payment Information</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method</span>
              <span className="font-medium capitalize">{order.payment_method || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Status</span>
              <span className={`font-medium ${
                order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {order.payment_status?.toUpperCase() || 'UNPAID'}
              </span>
            </div>
          </div>
        </div>

        {latestRefund && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-gray-600" />
              Refund Request
            </h2>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">
                  Request #{latestRefund.id}
                </p>
                <span className={`inline-flex w-fit px-3 py-1 rounded-full text-xs font-semibold ${
                  latestRefund.refund_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  latestRefund.refund_status === 'approved' ? 'bg-green-100 text-green-700' :
                  latestRefund.refund_status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {latestRefund.refund_status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-700">{latestRefund.reason}</p>
              {latestRefund.admin_response && (
                <div className="rounded-lg bg-white border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Admin Response</p>
                  <p className="text-sm text-gray-700">{latestRefund.admin_response}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {canRate() && (
            <button
              onClick={() => setShowRatingModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 text-black rounded-xl font-semibold hover:bg-yellow-500 transition"
            >
              <Star className="h-5 w-5" />
              Rate Order
            </button>
          )}
          
          {canRequestRefund() && (
            <button
              onClick={() => setShowRefundModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition"
            >
              <AlertCircle className="h-5 w-5" />
              Report Issue / Refund
            </button>
          )}

          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition"
          >
            <Home className="h-5 w-5" />
            Continue Shopping
          </Link>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Request Refund</h2>
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundProofFiles([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Order #{order.id} - {formatPrice(order.total_amount)}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What happened?
            </label>
            <select
              value={refundReasonType}
              onChange={(e) => setRefundReasonType(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-black focus:border-black"
            >
              <option value="missing_item">Missing item</option>
              <option value="damaged_item">Damaged item</option>
              <option value="wrong_item">Wrong item received</option>
              <option value="defective_item">Defective item</option>
              <option value="other">Other issue</option>
            </select>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Please describe the issue, affected item, and any details the refund team should review..."
              className="w-full p-3 border border-gray-300 rounded-lg h-32 mb-4 focus:ring-2 focus:ring-black focus:border-black resize-none"
            />
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proof photos or videos
            </label>
            <label className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-600 hover:bg-gray-50">
              <Paperclip className="h-4 w-4" />
              Attach proof
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || [])
                    .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
                    .filter((file) => file.size <= 25 * 1024 * 1024)
                    .slice(0, 5);
                  setRefundProofFiles(files);
                }}
              />
            </label>
            {refundProofFiles.length > 0 && (
              <div className="mb-2 space-y-1">
                {refundProofFiles.map((file) => (
                  <p key={`${file.name}-${file.size}`} className="text-xs text-gray-500 truncate">
                    {file.name}
                  </p>
                ))}
              </div>
            )}
            <p className="mb-4 text-xs text-gray-500">Up to 5 files, 25MB each.</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundProofFiles([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRefund}
                disabled={!refundReason.trim() || submittingRefund}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {submittingRefund ? 'Uploading...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Rate Your Order</h2>
              <button
                onClick={() => setShowRatingModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              How was your experience with Order #{order.id}?
            </p>
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star className={`h-10 w-10 ${
                    star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                  }`} />
                </button>
              ))}
            </div>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Share your experience with this order (optional)..."
              className="w-full p-3 border border-gray-300 rounded-lg h-24 mb-4 focus:ring-2 focus:ring-black focus:border-black resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRatingModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRating}
                disabled={rating === 0 || submittingRating}
                className="flex-1 px-4 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition disabled:opacity-50"
              >
                {submittingRating ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
