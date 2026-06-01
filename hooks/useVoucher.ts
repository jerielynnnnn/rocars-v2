// hooks/useVoucher.ts
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Voucher {
  id: number
  code: string
  type: 'fixed' | 'percentage' | 'free_shipping'
  value: number
  min_spend: number
  max_discount: number | null
  description: string | null
  valid_until: string
  is_active: boolean
  used_count?: number
  usage_limit?: number
}

export function useVoucher(subtotal: number, shippingFee: number) {
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null)
  const [discount, setDiscount] = useState(0)
  const [freeShipping, setFreeShipping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([])

  const calculateDiscount = (voucher: Voucher, subtotalAmount: number): number => {
    if (voucher.type === 'percentage') {
      let discountAmount = (subtotalAmount * voucher.value) / 100
      if (voucher.max_discount && discountAmount > voucher.max_discount) {
        discountAmount = voucher.max_discount
      }
      return Math.min(discountAmount, subtotalAmount)
    } else if (voucher.type === 'fixed') {
      return Math.min(voucher.value, subtotalAmount)
    }
    return 0
  }

  const fetchAvailableVouchers = async (userId: string) => {
    try {
      // Get user's claimed vouchers
      const { data: claimedVouchers } = await supabase
        .from('voucher_usage')
        .select('voucher_id')
        .eq('user_id', userId)

      const claimedIds = claimedVouchers?.map(v => v.voucher_id) || []

      // Get available vouchers that user hasn't claimed
      const { data: vouchers, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString())
        .gte('valid_until', new Date().toISOString())
        .not('id', 'in', `(${claimedIds.join(',') || 0})`)

      if (!error && vouchers) {
        // Filter vouchers that meet min_spend requirement
        const applicableVouchers = vouchers.filter(v => subtotal >= v.min_spend)
        setAvailableVouchers(applicableVouchers)
        return applicableVouchers
      }
    } catch (err) {
      console.error('Error fetching vouchers:', err)
    }
    return []
  }

  const applyVoucher = async (code: string) => {
    setLoading(true)
    setError(null)

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Please login to use vouchers')
        setLoading(false)
        return false
      }

      // Check if user has claimed this voucher
      const { data: claimedVoucher, error: claimError } = await supabase
        .from('voucher_usage')
        .select('voucher_id')
        .eq('user_id', session.user.id)
        .eq('voucher_code', code.toUpperCase())
        .maybeSingle()

      if (claimError) {
        setError('Error checking voucher')
        setLoading(false)
        return false
      }

      if (!claimedVoucher) {
        setError('Please claim this voucher first from the products page')
        setLoading(false)
        return false
      }

      // Fetch voucher details
      const { data: voucher, error: voucherError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (voucherError || !voucher) {
        setError('Invalid voucher code')
        setLoading(false)
        return false
      }

      // Check expiration
      if (new Date(voucher.valid_until) < new Date()) {
        setError('This voucher has expired')
        setLoading(false)
        return false
      }

      // Check min spend
      if (subtotal < voucher.min_spend) {
        setError(`Minimum spend of ₱${voucher.min_spend.toLocaleString()} required`)
        setLoading(false)
        return false
      }

      // Calculate discount
      let discountAmount = 0
      let isFreeShipping = false

      if (voucher.type === 'free_shipping') {
        isFreeShipping = true
        discountAmount = 0
      } else {
        discountAmount = calculateDiscount(voucher, subtotal)
      }

      setAppliedVoucher(voucher)
      setDiscount(discountAmount)
      setFreeShipping(isFreeShipping)
      setError(null)
      setLoading(false)
      return true

    } catch (err) {
      console.error('Error applying voucher:', err)
      setError('Failed to apply voucher')
      setLoading(false)
      return false
    }
  }

  const removeVoucher = () => {
    setAppliedVoucher(null)
    setDiscount(0)
    setFreeShipping(false)
    setVoucherCode('')
    setError(null)
  }

  const finalShippingFee = freeShipping ? 0 : shippingFee
  const total = subtotal - discount + finalShippingFee

  return {
    voucherCode,
    setVoucherCode,
    appliedVoucher,
    discount,
    freeShipping,
    error,
    loading,
    availableVouchers,
    applyVoucher,
    removeVoucher,
    fetchAvailableVouchers,
    finalShippingFee,
    total,
  }
}