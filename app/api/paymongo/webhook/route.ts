
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('================ PAYMONGO WEBHOOK ================')
    console.log(JSON.stringify(body, null, 2))

    const eventType = body?.data?.attributes?.type
    const resource = body?.data?.attributes?.data

    // =====================================================
    // PAYMENT PAID
    // =====================================================
    if (eventType === 'payment.paid') {
      const paymentData = resource?.attributes

      const metadata = paymentData?.metadata || {}

      const orderId = metadata?.orderId

      if (!orderId) {
        console.error('Missing orderId in metadata')

        return NextResponse.json(
          {
            success: false,
            error: 'Missing orderId',
          },
          { status: 400 }
        )
      }

      console.log('Processing successful payment for order:', orderId)

      // =====================================================
      // UPDATE ORDER
      // =====================================================
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          order_status: 'processing',
          payment_transaction_id: paymentData?.id || null,
          payment_provider: 'paymongo',
        })
        .eq('id', parseInt(orderId))

      if (orderError) {
        console.error('ORDER UPDATE ERROR:', orderError)
      }

      // =====================================================
      // INSERT PAYMENT RECORD
      // =====================================================
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          order_id: parseInt(orderId),
          payment_provider: 'paymongo',
          transaction_id: paymentData?.id || '',
          amount: (paymentData?.amount || 0) / 100,
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        })

      if (paymentError) {
        console.error('PAYMENT INSERT ERROR:', paymentError)
      }

      // =====================================================
      // INSERT ORDER STATUS HISTORY
      // =====================================================
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: parseInt(orderId),
          status: 'processing',
          notes: 'Payment successfully received through PayMongo',
        })

      if (historyError) {
        console.error('STATUS HISTORY ERROR:', historyError)
      }

      // =====================================================
      // GET ORDER USER
      // =====================================================
      const { data: orderData, error: orderFetchError } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', parseInt(orderId))
        .single()

      if (orderFetchError) {
        console.error('ORDER FETCH ERROR:', orderFetchError)
      }

      // =====================================================
      // CREATE NOTIFICATION
      // =====================================================
      if (orderData?.user_id) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: orderData.user_id,
            title: 'Payment Successful',
            message: `Your payment for Order #${orderId} was received successfully.`,
          })

        if (notificationError) {
          console.error('NOTIFICATION ERROR:', notificationError)
        }
      }

      console.log('Payment processed successfully')

      return NextResponse.json({
        success: true,
      })
    }

    // =====================================================
    // PAYMENT FAILED
    // =====================================================
    if (eventType === 'payment.failed') {
      const paymentData = resource?.attributes

      const metadata = paymentData?.metadata || {}

      const orderId = metadata?.orderId

      if (!orderId) {
        return NextResponse.json({ success: true })
      }

      console.log('Processing failed payment for order:', orderId)

      // Update order
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled',
        })
        .eq('id', parseInt(orderId))

      // Insert history
      await supabase
        .from('order_status_history')
        .insert({
          order_id: parseInt(orderId),
          status: 'cancelled',
          notes: 'Payment failed through PayMongo',
        })

      return NextResponse.json({ success: true })
    }

    // =====================================================
    // DEFAULT RESPONSE
    // =====================================================
    return NextResponse.json({
      success: true,
      message: 'Webhook received',
    })
  } catch (error) {
    console.error('WEBHOOK ERROR:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
      }
    )
  }
}
