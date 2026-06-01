import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      user_id, 
      items, 
      address, 
      payment_method, 
      subtotal, 
      shipping_fee, 
      total_amount,
      payment_transaction_id 
    } = body

    if (!user_id || !items || !address) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 1. Create address
    const { data: newAddress, error: addressError } = await supabase
      .from('addresses')
      .insert({
        user_id: user_id,
        recipient_first_name: address.firstName || address.recipientName?.split(' ')[0] || '',
        recipient_last_name: address.lastName || address.recipientName?.split(' ').slice(1).join(' ') || '',
        phone_number: address.phoneNumber,
        street_address: address.streetAddress,
        barangay: address.barangay,
        city: address.city,
        province: address.province,
        zip_code: address.zipCode,
        is_default: false
      })
      .select()
      .single()

    if (addressError) {
      console.error('Address creation error:', addressError)
      return NextResponse.json(
        { error: 'Failed to create address' },
        { status: 500 }
      )
    }

    // 2. Create order
    const orderStatus = payment_method === 'gcash' ? 'pending_payment' : 'confirmed'
    const paymentStatus = payment_method === 'gcash' ? 'pending' : 'paid'

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user_id,
        address_id: newAddress.id,
        order_status: orderStatus,
        payment_status: paymentStatus,
        subtotal: subtotal,
        shipping_fee: shipping_fee || 0,
        total_amount: total_amount,
        payment_method: payment_method,
        payment_transaction_id: payment_transaction_id || null
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    // 3. Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      price: item.price
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Order items creation error:', itemsError)
      return NextResponse.json(
        { error: 'Failed to create order items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      order: order,
      orderId: order.id
    })

  } catch (error) {
    console.error('Order creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}