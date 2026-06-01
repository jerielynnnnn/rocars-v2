import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, description, orderId, successUrl, cancelUrl } = body

    // Validate input
    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Call PayMongo API to create a payment intent
    // This is an example - you'll need to implement actual PayMongo integration
    const paymongoResponse = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/checkout?payment_canceled=true&orderId=${orderId}`,
            success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/order-success?orderId=${orderId}`,
            description: description || `Order #${orderId}`,
            line_items: [
              {
                currency: 'PHP',
                amount: Number(amount),
                description: description || `Order #${orderId}`,
                name: `ROCARS Order #${orderId}`,
                quantity: 1,
              },
            ],
            payment_method_types: ['gcash'],
          },
        },
      }),
    })

    const paymongoData = await paymongoResponse.json()

    if (!paymongoResponse.ok) {
      console.error('PayMongo error:', paymongoData)
      return NextResponse.json(
        { error: paymongoData.errors?.[0]?.detail || 'Payment service error' },
        { status: paymongoResponse.status }
      )
    }

    const checkoutUrl = paymongoData.data.attributes.checkout_url
    const paymentIntentId = paymongoData.data.id

    return NextResponse.json({
      success: true,
      checkoutUrl,
      paymentIntentId,
    })
  } catch (error) {
    console.error('Create payment intent error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}