import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)
    
    console.log('Webhook received:', body.data?.attributes?.type)
    
    // Extract event data
    const event = body.data
    const eventType = event?.attributes?.type
    
    // Handle checkout_session.payment.paid event
    if (eventType === 'checkout_session.payment.paid') {
      const checkoutSession = event.attributes.data
      const metadata = checkoutSession.attributes.metadata || {}
      const orderId = metadata.order_id
      const paymentIntentId = checkoutSession.id
      
      console.log(`Processing successful payment for order: ${orderId}`)
      
      if (orderId) {
        // Update order status
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            order_status: 'processing',
            payment_transaction_id: paymentIntentId,
            payment_method_details: {
              type: 'gcash',
              paid_at: new Date().toISOString()
            }
          })
          .eq('id', parseInt(orderId))
        
        if (updateError) {
          console.error('Error updating order:', updateError)
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
        }
        
        console.log(`Order ${orderId} updated successfully`)
        
        // Optional: Send notification to user
        // await sendOrderConfirmationEmail(orderId)
      }
    }
    
    // Handle payment.failed event
    if (eventType === 'payment.failed') {
      const payment = event.attributes.data
      const metadata = payment.attributes.metadata || {}
      const orderId = metadata.order_id
      
      console.log(`Payment failed for order: ${orderId}`)
      
      if (orderId) {
        // Update order status to failed
        await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            order_status: 'cancelled',
            cancellation_reason: 'Payment failed'
          })
          .eq('id', parseInt(orderId))
      }
    }
    
    return NextResponse.json({ received: true })
    
  } catch (error) {
    console.error('Webhook error:', error)
    // Always return 200 to acknowledge receipt, even on error
    // PayMongo will retry if you return non-200
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 200 })
  }
}

// Verify webhook signature (optional but recommended for security)
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return true // Skip verification in dev
  
  const crypto = require('crypto')
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  
  return signature === expectedSignature
}