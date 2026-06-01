import { NextRequest, NextResponse } from 'next/server';

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('=== verify-payment API called ===');
    
    const body = await request.json();
    const { paymentIntentId } = body;

    console.log('Payment Intent ID:', paymentIntentId);

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing payment intent ID' },
        { status: 400 }
      );
    }

    if (!PAYMONGO_SECRET_KEY) {
      console.error('PAYMONGO_SECRET_KEY is not set');
      return NextResponse.json(
        { error: 'Payment configuration error' },
        { status: 500 }
      );
    }

    // Get payment intent status from PayMongo
    const response = await fetch(`https://api.paymongo.com/v1/checkout_links/${paymentIntentId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY).toString('base64')}`
      }
    });

    const data = await response.json();

    console.log('PayMongo verification response status:', response.status);

    if (!response.ok) {
      console.error('PayMongo verification error:', data);
      throw new Error(data.errors?.[0]?.detail || 'Failed to verify payment');
    }

    // Check payment status
    const status = data.data.attributes.status;
    const isPaid = status === 'paid';

    console.log('Payment status:', status, 'Is paid:', isPaid);

    return NextResponse.json({
      success: true,
      status: status,
      isPaid: isPaid,
      paymentData: data.data.attributes
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify payment' },
      { status: 500 }
    );
  }
}