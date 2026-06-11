import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      user_id,
      items,
      address,
      address_id,
      payment_method,
      subtotal,
      shipping_fee,
      total_amount,
      payment_transaction_id,
      order_status,
      payment_status,
      notes,
      voucher_id,
      voucher_discount,
      voucher_code,
      free_shipping,
    } = body

    if (!user_id || !items || (!address_id && !address)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const client = supabaseAdmin ?? supabase

    let resolvedAddressId = address_id ?? null

    if (!resolvedAddressId && address) {
      const { data: newAddress, error: addressError } = await client
        .from('addresses')
        .insert({
          user_id,
          recipient_first_name: address.firstName || address.recipientName?.split(' ')[0] || '',
          recipient_last_name: address.lastName || address.recipientName?.split(' ').slice(1).join(' ') || '',
          phone_number: address.phoneNumber,
          street_address: address.streetAddress,
          barangay: address.barangay,
          city: address.city,
          province: address.province,
          zip_code: address.zipCode,
          is_default: false,
        })
        .select('id')
        .single()

      if (addressError || !newAddress) {
        console.error('Address creation error:', addressError)
        return NextResponse.json(
          { error: 'Failed to create address' },
          { status: 500 }
        )
      }

      resolvedAddressId = newAddress.id
    }

    const finalOrderStatus = order_status || (payment_method === 'gcash' ? 'pending_payment' : 'pending')
    const finalPaymentStatus = payment_status || (payment_method === 'gcash' ? 'pending' : 'paid')

    const { data: order, error: orderError } = await client
      .from('orders')
      .insert({
        user_id,
        address_id: resolvedAddressId,
        order_status: finalOrderStatus,
        payment_status: finalPaymentStatus,
        subtotal,
        shipping_fee: shipping_fee || 0,
        total_amount,
        payment_method,
        notes: notes || null,
        payment_transaction_id: payment_transaction_id || null,
        voucher_id: voucher_id ?? null,
        voucher_discount: voucher_discount ?? 0,
        voucher_code: voucher_code ?? null,
        free_shipping: Boolean(free_shipping),
      })
      .select('*')
      .single()

    if (orderError || !order) {
      console.error('Order creation error:', orderError)
      return NextResponse.json(
        { error: orderError?.message || 'Failed to create order' },
        { status: 500 }
      )
    }

    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
    }))

    const { error: itemsError } = await client
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
      order,
      orderId: order.id,
    })
  } catch (error) {
    console.error('Order creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}