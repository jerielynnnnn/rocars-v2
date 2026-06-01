export interface Voucher {
  id: number
  code: string
  type: 'fixed' | 'percentage' | 'free_shipping'
  value: number
  min_spend: number
  max_discount: number | null
  usage_limit: number | null
  used_count: number
  valid_from: string
  valid_until: string
  is_active: boolean
  description: string | null
}

export interface VoucherValidationResult {
  valid: boolean
  discountAmount: number
  freeShipping: boolean
  error?: string
}

export function validateAndCalculateVoucher(
  voucher: Voucher,
  subtotal: number,
  shippingFee: number
): VoucherValidationResult {
  const now = new Date()
  const validFrom = new Date(voucher.valid_from)
  const validUntil = new Date(voucher.valid_until)

  // Check if voucher is active
  if (!voucher.is_active) {
    return { valid: false, discountAmount: 0, freeShipping: false, error: 'Voucher is not active' }
  }

  // Check date validity
  if (now < validFrom) {
    return { valid: false, discountAmount: 0, freeShipping: false, error: 'Voucher not yet valid' }
  }
  if (now > validUntil) {
    return { valid: false, discountAmount: 0, freeShipping: false, error: 'Voucher has expired' }
  }

  // Check usage limit
  if (voucher.usage_limit && voucher.used_count >= voucher.usage_limit) {
    return { valid: false, discountAmount: 0, freeShipping: false, error: 'Voucher usage limit reached' }
  }

  // Check minimum spend
  if (subtotal < voucher.min_spend) {
    return { 
      valid: false, 
      discountAmount: 0, 
      freeShipping: false, 
      error: `Minimum spend of ₱${voucher.min_spend.toLocaleString()} required` 
    }
  }

  // Calculate discount based on type
  if (voucher.type === 'free_shipping') {
    return { valid: true, discountAmount: 0, freeShipping: true }
  }

  if (voucher.type === 'percentage') {
    let discount = (subtotal * voucher.value) / 100
    if (voucher.max_discount && discount > voucher.max_discount) {
      discount = voucher.max_discount
    }
    return { valid: true, discountAmount: Math.round(discount), freeShipping: false }
  }

  if (voucher.type === 'fixed') {
    let discount = voucher.value
    if (voucher.max_discount && discount > voucher.max_discount) {
      discount = voucher.max_discount
    }
    return { valid: true, discountAmount: Math.min(discount, subtotal), freeShipping: false }
  }

  return { valid: false, discountAmount: 0, freeShipping: false, error: 'Invalid voucher type' }
}