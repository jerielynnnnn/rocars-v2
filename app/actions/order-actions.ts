'use server';

import { supabase } from '@/lib/supabase';  // Use supabase directly
import { revalidatePath } from 'next/cache';

interface ProcessOrderParams {
  userId: string;
  addressId: number;
  paymentMethod: string;
  paymentProvider: string;
  transactionId: string;
  notes?: string;
}

// Complete order after successful payment
export async function processCompletedOrder(params: ProcessOrderParams) {
  const { data: orderId, error } = await supabase.rpc('process_completed_order', {
    p_user_id: params.userId,
    p_address_id: params.addressId,
    p_payment_method: params.paymentMethod,
    p_payment_provider: params.paymentProvider,
    p_transaction_id: params.transactionId,
    p_notes: params.notes || null
  });

  if (error) {
    console.error('Process order error:', error);
    throw new Error(error.message);
  }
  
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  
  return { success: true, orderId };
}

// Update order status
export async function updateOrderStatus(orderId: number, newStatus: string, notes?: string) {
  const { error } = await supabase.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_notes: notes || null
  });
  
  if (error) {
    console.error('Update status error:', error);
    throw new Error(error.message);
  }
  
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
  
  return { success: true };
}

// Request refund for an order
export async function requestRefund(orderId: number, userId: string, reason: string) {
  // Check if refund already exists
  const { data: existingRefund } = await supabase
    .from('refunds')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existingRefund) {
    throw new Error('Refund already requested for this order');
  }
  
  const { error } = await supabase.rpc('request_refund', {
    p_order_id: orderId,
    p_user_id: userId,
    p_reason: reason
  });
  
  if (error) {
    console.error('Refund request error:', error);
    throw new Error(error.message);
  }
  
  revalidatePath(`/orders/${orderId}`);
  
  return { success: true };
}

// Rate an order after delivery
export async function rateOrder(orderId: number, userId: string, rating: number, comment?: string) {
  // Validate rating
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  
  const { error } = await supabase.rpc('rate_order', {
    p_order_id: orderId,
    p_user_id: userId,
    p_rating: rating,
    p_comment: comment || null
  });
  
  if (error) {
    console.error('Rating error:', error);
    throw new Error(error.message);
  }
  
  revalidatePath(`/orders/${orderId}`);
  
  return { success: true };
}

// Cancel an order (only if not yet processed)
export async function cancelOrder(orderId: number, userId: string, reason: string) {
  // Get current order status
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('order_status')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();
  
  if (fetchError) throw new Error('Order not found');
  
  // Check if order can be cancelled (only pending or order_placed)
  if (!['order_placed', 'pending'].includes(order.order_status)) {
    throw new Error('Order cannot be cancelled at this stage');
  }
  
  const { error } = await supabase
    .from('orders')
    .update({
      order_status: 'cancelled',
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString()
    })
    .eq('id', orderId);
  
  if (error) throw new Error(error.message);
  
  // Add to status history
  await supabase.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: 'cancelled',
    p_notes: `Order cancelled by user. Reason: ${reason}`
  });
  
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
  
  return { success: true };
}

// Get order with full details
export async function getOrderDetails(orderId: number) {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
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
    .single();
  
  if (error) throw new Error(error.message);
  
  return order;
}

// Get all orders for current user
export async function getUserOrders(statusFilter?: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) throw new Error('Not authenticated');
  if (!user) throw new Error('User not found');
  
  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (count),
      order_status_history (status, created_at)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('order_status', statusFilter);
  }
  
  const { data: orders, error } = await query;
  
  if (error) throw new Error(error.message);
  
  return orders;
}