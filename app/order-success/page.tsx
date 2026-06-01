'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PageContainer from '@/components/layout/PageContainer'
import PageSection from '@/components/layout/PageSection'
import {
  CheckCircle,
  Loader2,
  XCircle,
} from 'lucide-react'

export default function OrderSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [orderId, setOrderId] = useState('')

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const orderIdParam = searchParams?.get('orderId')
        const paymentIntentId = searchParams?.get('payment_intent') || searchParams?.get('paymentIntentId')
        const redirectStatus = searchParams?.get('redirect_status')
        
        // Get session_id from PayMongo (might be different param name)
        const sessionId = searchParams?.get('session_id')
        
        const effectiveOrderId = orderIdParam || sessionId

        if (!effectiveOrderId) {
          console.error('No order ID found in URL')
          setStatus('error')
          return
        }

        console.log('Verifying payment for order:', effectiveOrderId)

        // First check if order already has payment_status = 'paid'
        const { data: existingOrder, error: fetchError } = await supabase
          .from('orders')
          .select('payment_status, order_status')
          .eq('id', parseInt(effectiveOrderId))
          .single()

        if (fetchError) {
          console.error('Fetch order error:', fetchError)
        }

        // If already paid, just show success
        if (existingOrder?.payment_status === 'paid') {
          setOrderId(effectiveOrderId)
          setStatus('success')
          return
        }

        // Update order to paid status
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            order_status: 'pending',
            payment_transaction_id: paymentIntentId || sessionId || null,
          })
          .eq('id', parseInt(effectiveOrderId))

        if (orderError) {
          console.error('ORDER UPDATE ERROR:', orderError)
          setStatus('error')
          return
        }

        // Get order data for payment record
        const { data: orderData, error: orderFetchError } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('id', parseInt(effectiveOrderId))
          .single()

        if (orderFetchError) {
          console.error('FETCH ORDER ERROR:', orderFetchError)
        }

        // Create payment record
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            order_id: parseInt(effectiveOrderId),
            payment_provider: 'paymongo',
            transaction_id: paymentIntentId || sessionId || `PAY-${Date.now()}`,
            amount: Number(orderData?.total_amount) || 0,
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          })

        if (paymentError) {
          console.error('PAYMENT RECORD ERROR:', paymentError)
          // Don't fail the whole process for this
        }

        // Clear cart items
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', session.user.id)
        }

        // Clear local storage
        localStorage.removeItem('cart')
        localStorage.removeItem('checkoutSummary')
        localStorage.removeItem('pendingGcashOrder')
        localStorage.removeItem('currentPaymentIntentId')
        localStorage.removeItem('currentOrderId')

        setOrderId(effectiveOrderId)
        setStatus('success')
      } catch (error) {
        console.error('VERIFY PAYMENT ERROR:', error)
        setStatus('error')
      }
    }

    verifyPayment()
  }, [searchParams])

  if (status === 'loading') {
    return (
      <PageSection className="flex items-center justify-center">
  <PageContainer size="sm">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Verifying Payment</h1>
          <p className="text-gray-600">Please wait while we confirm your payment...</p>
         </PageContainer>
</PageSection>
    )
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Verification Failed</h1>
          <p className="text-gray-600 mb-6">
            We could not verify your payment. If your money was deducted, please contact support.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/checkout"
              className="bg-yellow-400 hover:bg-yellow-500 text-black py-3 rounded-xl font-semibold transition text-center"
            >
              Return to Checkout
            </Link>
            <Link
              href="/cart"
              className="border border-gray-300 hover:bg-gray-50 py-3 rounded-xl font-semibold transition text-center"
            >
              Back to Cart
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-5" />
        <h1 className="text-3xl font-bold mb-3">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your payment has been processed successfully.
          <br />
          Your ROCARS order is now confirmed.
        </p>

        {orderId && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Order ID</p>
            <p className="font-bold text-lg">#{orderId}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href={`/order-confirmation?orderId=${orderId}`}
            className="bg-yellow-400 hover:bg-yellow-500 text-black py-3 rounded-xl font-semibold transition text-center"
          >
            View Order Details
          </Link>
          <Link
            href="/products"
            className="border border-gray-300 hover:bg-gray-50 py-3 rounded-xl font-semibold transition text-center"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  )
}