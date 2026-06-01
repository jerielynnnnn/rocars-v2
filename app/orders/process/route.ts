import { supabase } from '@/lib/supabase';  // Use supabase directly
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, addressId, paymentMethod, paymentProvider, transactionId } = body;

    if (!userId || !addressId || !paymentMethod || !transactionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, addressId, paymentMethod, transactionId' },
        { status: 400 }
      );
    }

    // Call the database function to process completed order
    const { data: orderId, error } = await supabase.rpc('process_completed_order', {
      p_user_id: userId,
      p_address_id: addressId,
      p_payment_method: paymentMethod,
      p_payment_provider: paymentProvider || 'gcash',
      p_transaction_id: transactionId,
      p_notes: `Payment completed via ${paymentProvider} with transaction ID: ${transactionId}`
    });

    if (error) {
      console.error('RPC Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to process order' },
        { status: 500 }
      );
    }

    // Schedule automatic status updates for test mode
    const scheduleStatusUpdates = async (orderId: number) => {
      const statusSchedule = [
        { status: 'confirmed', delay: 5 * 1000, notes: 'Order confirmed automatically' },
        { status: 'processing', delay: 30 * 1000, notes: 'Order is being processed' },
        { status: 'shipped', delay: 60 * 1000, notes: 'Order has been shipped' },
        { status: 'delivered', delay: 120 * 1000, notes: 'Order delivered successfully' }
      ];

      for (const schedule of statusSchedule) {
        setTimeout(async () => {
          try {
            await supabase.rpc('update_order_status', {
              p_order_id: orderId,
              p_new_status: schedule.status,
              p_notes: schedule.notes
            });
            console.log(`Order ${orderId} status updated to: ${schedule.status}`);
          } catch (err) {
            console.error(`Failed to update order ${orderId} to ${schedule.status}:`, err);
          }
        }, schedule.delay);
      }
    };

    // Schedule automatic updates (for testing only)
    await scheduleStatusUpdates(orderId);

    return NextResponse.json({ 
      success: true, 
      orderId,
      message: 'Order processed successfully'
    });
    
  } catch (error: any) {
    console.error('Process order error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET method to check order status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_status_history(*)')
    .eq('id', orderId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, order: data });
}