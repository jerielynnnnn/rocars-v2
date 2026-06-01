import { supabase } from '@/lib/supabase'

export async function validateVoucher(
  code: string,
  subtotal: number
) {
  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !voucher) {
    return {
      valid: false,
      message: 'Voucher not found',
    }
  }

  if (!voucher.is_active) {
    return {
      valid: false,
      message: 'Voucher is inactive',
    }
  }

  const now = new Date()

  if (new Date(voucher.valid_from) > now) {
    return {
      valid: false,
      message: 'Voucher is not active yet',
    }
  }

  if (new Date(voucher.valid_until) < now) {
    return {
      valid: false,
      message: 'Voucher has expired',
    }
  }

  if (
    voucher.usage_limit &&
    voucher.used_count >= voucher.usage_limit
  ) {
    return {
      valid: false,
      message: 'Voucher usage limit reached',
    }
  }

  if (subtotal < voucher.min_spend) {
    return {
      valid: false,
      message: `Minimum spend is ₱${voucher.min_spend}`,
    }
  }

  let discount = 0
  let freeShipping = false

  if (voucher.type === 'fixed') {
    discount = voucher.value
  }

  if (voucher.type === 'percentage') {
    discount = subtotal * (voucher.value / 100)

    if (
      voucher.max_discount &&
      discount > voucher.max_discount
    ) {
      discount = voucher.max_discount
    }
  }

  if (voucher.type === 'free_shipping') {
    freeShipping = true
  }

  return {
    valid: true,
    voucher,
    discount,
    freeShipping,
  }
}