
import { supabase } from '@/lib/supabase'
import { nowIso } from '@/lib/time'

export async function createOrder({
  userId,
  addressId,
  items,
  subtotal,
  shippingFee,
  totalAmount,
  paymentMethod,
  paymentStatus,
}: {
  userId: string
  addressId: number
  items: any[]
  subtotal: number
  shippingFee: number
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
}) {
  // CREATE ORDER
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      address_id: addressId,
      order_status: 'pending',
      payment_status: paymentStatus,
      subtotal,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
      payment_method: paymentMethod,
    })
    .select()
    .single()

  if (orderError) {
    throw orderError
  }

  // CREATE ORDER ITEMS
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.id,
    quantity: item.quantity,
    price: item.price,
  }))

  const { error: itemError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (itemError) {
    throw itemError
  }

  // CREATE INITIAL STATUS HISTORY
  await supabase
    .from('order_status_history')
    .insert({
      order_id: order.id,
      status: 'pending',
      notes: 'Order placed successfully',
    })

  // CREATE USER NOTIFICATION
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: 'Order Placed',
      message: `Your order #${order.id} has been placed successfully.`
    })

  // DEDUCT STOCK
  for (const item of items) {
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.id)
      .single()

    if (product) {
      const newStock = product.stock - item.quantity

      await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.id)

      await supabase
        .from('inventory_logs')
        .insert({
          product_id: item.id,
          change_type: 'order_purchase',
          quantity: -item.quantity,
          notes: `Order #${order.id}`,
        })
    }
  }

  return order
}

export async function updateOrderStatus({
  orderId,
  status,
  adminId,
  trackingNumber,
}: {
  orderId: number
  status: string
  adminId: string
  trackingNumber?: string
}) {
  const updateData: any = {
    order_status: status,
  }

  if (trackingNumber) {
    updateData.tracking_number = trackingNumber
  }

  if (status === 'delivered') {
    updateData.delivered_at = nowIso()
  }

  const { data: order, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select('user_id')
    .single()

  if (error) {
    throw error
  }

  // STATUS HISTORY
  await supabase
    .from('order_status_history')
    .insert({
      order_id: orderId,
      status,
      notes: `Order updated to ${status}`,
    })

  // USER NOTIFICATION
  await supabase
    .from('notifications')
    .insert({
      user_id: order.user_id,
      title: 'Order Update',
      message: `Your order #${orderId} is now ${status}`,
    })

  // ADMIN LOG
  await supabase
    .from('admin_logs')
    .insert({
      admin_id: adminId,
      action: 'update_order_status',
      target_type: 'order',
      target_id: String(orderId),
      details: {
        status,
      },
    })
}
