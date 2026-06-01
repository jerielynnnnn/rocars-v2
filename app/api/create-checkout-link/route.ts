import { NextRequest, NextResponse } from 'next/server';

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { amount, description, successUrl, cancelUrl } = await request.json();

    const response = await fetch('https://api.paymongo.com/v1/checkout_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY).toString('base64')}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(amount * 100),
            currency: 'PHP',
            description: description,
            payment_method_types: ['gcash'],
            success_url: successUrl,
            cancel_url: cancelUrl,
            statement_descriptor: 'ROCARS Auto'
          }
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) throw new Error('Failed to create checkout link');
    
    return NextResponse.json({
      checkoutUrl: data.data.attributes.checkout_url
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create checkout link' },
      { status: 500 }
    );
  }
}