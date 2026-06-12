'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import {
  Ticket,
  Gift,
  Clock,
  Tag,
  Percent,
  Truck,
  AlertCircle,
  CheckCircle,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

interface ClaimedVoucher {
  id: number;
  voucher_id: number;
  voucher_code: string;
  discount_amount: number;
  free_shipping: boolean;
  applied_at: string;
  created_at: string;
  used_in_order: boolean;
  order_id: number | null;
  voucher: {
    type: 'fixed' | 'percentage' | 'free_shipping';
    value: number;
    min_spend: number;
    max_discount: number | null;
    description: string | null;
    valid_until: string;
  };
}

export default function MyVouchersPage() {
  const router = useRouter();
  const [claimedVouchers, setClaimedVouchers] = useState<ClaimedVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession) {
      router.push('/login?redirect=/my-vouchers');
      return;
    }
    
    setSession(currentSession);
    await fetchMyVouchers(currentSession.user.id);
  };

  const fetchMyVouchers = async (userId: string) => {
    setLoading(true);
    try {
      // First, get all claimed vouchers from voucher_usage
      const { data: usageData, error: usageError } = await supabase
        .from('voucher_usage')
        .select(`
          id,
          voucher_id,
          voucher_code,
          discount_amount,
          free_shipping,
          applied_at,
          created_at,
          order_id
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (usageError) {
        console.error('Error fetching claimed vouchers:', usageError);
        setLoading(false);
        return;
      }

      if (!usageData || usageData.length === 0) {
        setClaimedVouchers([]);
        setLoading(false);
        return;
      }

      // Get voucher details for each claimed voucher
      const voucherIds = usageData.map(item => item.voucher_id);
      const { data: vouchersData, error: vouchersError } = await supabase
        .from('vouchers')
        .select('*')
        .in('id', voucherIds);

      if (vouchersError) {
        console.error('Error fetching voucher details:', vouchersError);
        setLoading(false);
        return;
      }

      // Create a map of voucher details
      const voucherMap = new Map();
      vouchersData?.forEach((voucher: any) => {
        voucherMap.set(voucher.id, voucher);
      });

      // Check which vouchers have been used in orders
      const orderIds = usageData.filter(item => item.order_id).map(item => item.order_id);
      let usedOrderIds: number[] = [];
      
      if (orderIds.length > 0) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id')
          .in('id', orderIds)
          .not('order_status', 'eq', 'cancelled');
        
        if (ordersData) {
          usedOrderIds = ordersData.map(order => order.id);
        }
      }

      // Combine the data
      const combinedVouchers: ClaimedVoucher[] = usageData.map(usage => {
        const voucherDetails = voucherMap.get(usage.voucher_id);
        const isUsed = usage.order_id !== null && usedOrderIds.includes(usage.order_id);
        
        return {
          ...usage,
          used_in_order: isUsed,
          voucher: voucherDetails || {
            type: 'fixed' as const,
            value: 0,
            min_spend: 0,
            max_discount: null,
            description: null,
            valid_until: new Date().toISOString(),
          }
        };
      });

      setClaimedVouchers(combinedVouchers);
    } catch (error) {
      console.error('Error fetching my vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVoucherIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="h-5 w-5" />;
      case 'free_shipping':
        return <Truck className="h-5 w-5" />;
      default:
        return <Tag className="h-5 w-5" />;
    }
  };

  const getVoucherBadge = (type: string, value: number) => {
    switch (type) {
      case 'percentage':
        return `${value}% OFF`;
      case 'fixed':
        return `₱${value.toLocaleString()} OFF`;
      case 'free_shipping':
        return 'FREE SHIPPING';
      default:
        return 'DISCOUNT';
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

  const isVoucherExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f6f4]">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Loading your vouchers...</p>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f6f4]">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-black transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-yellow-100">
              <Ticket className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black">My Vouchers</h1>
              <p className="text-sm text-gray-500 mt-1">
                View all the vouchers you've claimed
              </p>
            </div>
          </div>
        </div>

        {/* Vouchers List */}
        {claimedVouchers.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Gift className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Vouchers Yet</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              You haven't claimed any vouchers yet. Check out our available vouchers and start saving!
            </p>
            <button
              onClick={() => router.push('/products')}
              className="mt-6 px-6 py-3 bg-yellow-400 text-black rounded-xl font-medium hover:bg-yellow-500 transition"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {claimedVouchers.map((voucher) => {
              const isExpired = isVoucherExpired(voucher.voucher.valid_until);
              
              return (
                <div
                  key={voucher.id}
                  className={`relative overflow-hidden rounded-2xl border transition-all ${
                    voucher.used_in_order
                      ? 'bg-gray-100 border-gray-300 opacity-70'
                      : isExpired
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gradient-to-r from-yellow-50 to-white border-yellow-200'
                  }`}
                >
                  {/* Decorative Sparkles */}
                  <div className="absolute top-0 right-0">
                    <Sparkles className={`h-20 w-20 opacity-30 -rotate-12 ${
                      voucher.used_in_order ? 'text-gray-400' : 'text-yellow-300'
                    }`} />
                  </div>

                  <div className="p-5">
                    {/* Status Badge */}
                    <div className="flex justify-end mb-2">
                      {voucher.used_in_order ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                          Used
                        </span>
                      ) : isExpired ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-600">
                          Expired
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-600">
                          Available
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-xl ${
                        voucher.used_in_order ? 'bg-gray-200' : 'bg-yellow-100'
                      }`}>
                        {getVoucherIcon(voucher.voucher.type)}
                      </div>
                      <div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          voucher.used_in_order ? 'bg-gray-200 text-gray-600' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {getVoucherBadge(voucher.voucher.type, voucher.voucher.value)}
                        </span>
                        <p className="text-xs text-gray-400 mt-1 font-mono">
                          Code: {voucher.voucher_code}
                        </p>
                      </div>
                    </div>

                    <h3 className="font-bold text-black text-lg">
                      {voucher.voucher.type === 'percentage' && `${voucher.voucher.value}% OFF`}
                      {voucher.voucher.type === 'fixed' && `₱${voucher.voucher.value.toLocaleString()} OFF`}
                      {voucher.voucher.type === 'free_shipping' && 'Free Shipping'}
                    </h3>

                    {voucher.voucher.description && (
                      <p className="text-sm text-gray-500 mt-1">{voucher.voucher.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-400">
                      {voucher.voucher.min_spend > 0 && (
                        <span>Min. Spend {formatPrice(voucher.voucher.min_spend)}</span>
                      )}
                      {voucher.voucher.max_discount && voucher.voucher.type === 'percentage' && (
                        <span>Max {formatPrice(voucher.voucher.max_discount)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>
                          {isExpired ? 'Expired on: ' : 'Valid until: '}
                          {new Date(voucher.voucher.valid_until).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-400">
                      Claimed on: {new Date(voucher.created_at).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>

                    {/* Action Button */}
                    {!voucher.used_in_order && !isExpired && (
                      <button
                        onClick={() => router.push('/products')}
                        className="mt-4 w-full py-2.5 bg-yellow-400 text-black rounded-xl text-sm font-medium hover:bg-yellow-500 transition"
                      >
                        Shop Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
