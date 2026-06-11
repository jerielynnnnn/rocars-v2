'use client';

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import Footer from '@/components/Footer'
import {
  ShoppingCart,
  Heart,
  Truck,
  ShieldCheck,
  CreditCard,
  Package,
  CheckCircle,
  Zap,
  Gift,
  AlertCircle,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Tag,
  Percent,
  Clock,
  Sparkles,
  Star,
  Search,
  X,
} from 'lucide-react'

interface Product {
  id: number
  name: string
  slug: string
  description: string
  brand: string
  price: number
  sale_price: number | null
  discount_percent: number | null
  stock: number
  is_active: boolean
  category_id: number
  is_on_sale: boolean
}

interface Category {
  id: number
  name: string
  slug: string
  image_url?: string
}

interface Voucher {
  id: number
  code: string
  type: 'fixed' | 'percentage' | 'free_shipping'
  value: number
  min_spend: number
  max_discount: number | null
  description: string | null
  valid_until: string
  valid_from: string
  is_active: boolean
  used_count: number
  usage_limit: number | null
}

interface ProductRating {
  product_id: number
  average_rating: number
  review_count: number
}

const features = [
  { icon: Truck, title: 'Fast Delivery', desc: 'Nationwide shipping' },
  { icon: ShieldCheck, title: 'Trusted Quality', desc: 'Premium tested parts' },
  { icon: CreditCard, title: 'Secure Payment', desc: 'Safe transactions' },
  { icon: Package, title: 'Wide Selection', desc: 'Thousands of products' },
]

const PRODUCTS_PER_PAGE = 12

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const categorySlug = searchParams.get('category')
  const initialSearch = searchParams.get('search') || ''

  const { addToCart } = useCart()

  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [productImages, setProductImages] = useState<Map<number, string>>(new Map())
  const [productRatings, setProductRatings] = useState<Map<number, ProductRating>>(new Map())
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [claimedVouchers, setClaimedVouchers] = useState<number[]>([])
  const [claimingVoucher, setClaimingVoucher] = useState<number | null>(null)
  const [showVoucherAlert, setShowVoucherAlert] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categorySlug)
  const [searchQuery, setSearchQuery] = useState(initialSearch)

  const [wishlist, setWishlist] = useState<number[]>([])
  const [session, setSession] = useState<any>(null)

  const [addingStates, setAddingStates] = useState<Map<number, boolean>>(new Map())
  const [buyingStates, setBuyingStates] = useState<Map<number, boolean>>(new Map())

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1)

  // FLOATING VOUCHER MODAL STATE
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false)

  useEffect(() => {
    fetchCategories()
    fetchProducts()
    fetchVouchers()
    loadWishlist()
    checkAuth()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, selectedCategory, searchQuery, categories])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchQuery])

  useEffect(() => {
    if (session?.user) {
      loadUserVouchers(session.user.id)
    }
  }, [session])

  // Auto-hide alert after 3 seconds
  useEffect(() => {
    if (showVoucherAlert.show) {
      const timer = setTimeout(() => {
        setShowVoucherAlert({ show: false, message: '', type: 'success' })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showVoucherAlert])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setSession(session)
    if (session?.user) {
      await loadWishlistFromDB(session.user.id)
    }
  }

  const loadWishlistFromDB = async (userId: string) => {
    const { data } = await supabase
      .from('wishlists')
      .select('product_id')
      .eq('user_id', userId)

    if (data) {
      const wishlistIds = data.map((item) => item.product_id)
      setWishlist(wishlistIds)
      localStorage.setItem('wishlist', JSON.stringify(wishlistIds))
    }
  }

  const loadWishlist = () => {
    const saved = localStorage.getItem('wishlist')
    if (saved) {
      setWishlist(JSON.parse(saved))
    }
  }

  const loadUserVouchers = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('voucher_usage')
        .select('voucher_id')
        .eq('user_id', userId)

      if (error) {
        console.error('Error loading user vouchers:', error)
        return
      }

      if (data && data.length > 0) {
        const claimedIds = data.map(item => item.voucher_id)
        setClaimedVouchers(claimedIds)
      } else {
        setClaimedVouchers([])
      }
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (data && data.length > 0) {
      setCategories(data)
    }
  }

  const fetchProducts = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setProducts(data)

      const ids = data.map((p) => p.id)

      // Fetch product images
      const { data: images } = await supabase
        .from('product_images')
        .select('product_id, image_url')
        .in('product_id', ids)

      const imageMap = new Map<number, string>()
      images?.forEach((img) => {
        if (!imageMap.has(img.product_id)) {
          imageMap.set(img.product_id, img.image_url)
        }
      })
      setProductImages(imageMap)

      if (ids.length > 0) {
        const ratingsResponse = await fetch('/api/products/ratings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids }),
        })

        if (ratingsResponse.ok) {
          const { ratings } = await ratingsResponse.json() as { ratings?: ProductRating[] }
          const ratingsData: Map<number, ProductRating> = new Map()

          ratings?.forEach((rating) => {
            ratingsData.set(rating.product_id, rating)
          })

          setProductRatings(ratingsData)
        } else {
          setProductRatings(new Map())
        }
      } else {
        setProductRatings(new Map())
      }
    }

    setLoading(false)
  }

  // FIXED: Fetch only currently valid vouchers
  const fetchVouchers = async () => {
    // Check if user is authenticated first
    const { data: { session } } = await supabase.auth.getSession()
    
    // Don't fetch vouchers if not logged in
    if (!session) {
      setVouchers([])
      return
    }

    try {
      const now = new Date().toISOString()
      
      // Fetch only vouchers that are:
      // 1. Active (is_active = true)
      // 2. Valid from date <= now
      // 3. Valid until date >= now
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('is_active', true)
        .lte('valid_from', now)
        .gte('valid_until', now)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching vouchers:', error)
        return
      }

      if (data) {
        // Additional client-side filtering for safety
        const nowDate = new Date()
        const validVouchers = data.filter(voucher => {
          const validFrom = new Date(voucher.valid_from)
          const validUntil = new Date(voucher.valid_until)
          return validFrom <= nowDate && validUntil >= nowDate && voucher.is_active === true
        })
        
        setVouchers(validVouchers)
      }
    } catch (error) {
      console.error('Error in fetchVouchers:', error)
    }
  }

  const filterProducts = () => {
    let filtered = [...products]

    if (selectedCategory && categories.length > 0) {
      const category = categories.find((c) => c.slug === selectedCategory)
      if (category) {
        filtered = filtered.filter((p) => p.category_id === category.id)
      }
    }

    const query = searchQuery.trim().toLowerCase()

    if (query) {
      filtered = filtered.filter((product) => {
        const category = categories.find((item) => item.id === product.category_id)
        const searchableText = [
          product.name,
          product.brand,
          product.description,
          category?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return searchableText.includes(query)
      })
    }

    setFilteredProducts(filtered)
  }

  const handleCategoryClick = (slug: string | null) => {
    setSelectedCategory(slug)
    const params = new URLSearchParams()
    if (slug) {
      params.set('category', slug)
    }
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim())
    }
    router.push(`/products?${params.toString()}`)
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)

    const params = new URLSearchParams()
    if (selectedCategory) {
      params.set('category', selectedCategory)
    }
    if (value.trim()) {
      params.set('search', value.trim())
    }

    const queryString = params.toString()
    router.replace(queryString ? `/products?${queryString}` : '/products', { scroll: false })
  }

  const clearProductFilters = () => {
    setSelectedCategory(null)
    setSearchQuery('')
    router.push('/products')
  }

  const toggleWishlist = async (productId: number, e: React.MouseEvent) => {
    e.preventDefault()

    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (!currentSession) {
      router.push('/login')
      return
    }

    let updated: number[]

    if (wishlist.includes(productId)) {
      await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', currentSession.user.id)
        .eq('product_id', productId)
      updated = wishlist.filter((id) => id !== productId)
    } else {
      await supabase.from('wishlists').insert({
        user_id: currentSession.user.id,
        product_id: productId,
      })
      updated = [...wishlist, productId]
    }

    setWishlist(updated)
    localStorage.setItem('wishlist', JSON.stringify(updated))
  }

  const handleClaimVoucher = async (voucher: Voucher, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Check if user is logged in
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    
    if (!currentSession) {
      setShowVoucherAlert({ 
        show: true, 
        message: 'Please login to claim this voucher!', 
        type: 'error' 
      })
      setTimeout(() => {
        router.push('/login')
      }, 1500)
      return
    }

    // Check if already claimed
    if (claimedVouchers.includes(voucher.id)) {
      setShowVoucherAlert({ 
        show: true, 
        message: 'You have already claimed this voucher!', 
        type: 'error' 
      })
      return
    }

    // Check if voucher is still valid (expiration check)
    const now = new Date()
    const validUntil = new Date(voucher.valid_until)
    const validFrom = new Date(voucher.valid_from)
    
    if (now < validFrom) {
      setShowVoucherAlert({ 
        show: true, 
        message: 'This voucher is not yet available!', 
        type: 'error' 
      })
      return
    }
    
    if (now > validUntil) {
      setShowVoucherAlert({ 
        show: true, 
        message: 'This voucher has expired!', 
        type: 'error' 
      })
      // Refresh vouchers to remove expired ones
      await fetchVouchers()
      return
    }

    setClaimingVoucher(voucher.id)

    try {
      // First, check if the voucher is still valid in the database
      const { data: voucherData, error: voucherError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('id', voucher.id)
        .single()

      if (voucherError) {
        throw new Error('Failed to fetch voucher details')
      }

      if (!voucherData || !voucherData.is_active) {
        throw new Error('This voucher is no longer active')
      }

      if (new Date(voucherData.valid_until) < new Date()) {
        throw new Error('This voucher has expired')
      }

      if (voucherData.usage_limit && voucherData.used_count >= voucherData.usage_limit) {
        throw new Error('This voucher has reached its usage limit')
      }

      // Check if user already claimed this voucher
      const { data: existingClaim, error: checkError } = await supabase
        .from('voucher_usage')
        .select('id')
        .eq('user_id', currentSession.user.id)
        .eq('voucher_id', voucher.id)
        .maybeSingle()

      if (checkError) {
        throw new Error('Failed to check existing claims')
      }

      if (existingClaim) {
        setShowVoucherAlert({ 
          show: true, 
          message: 'You have already claimed this voucher!', 
          type: 'error' 
        })
        setClaimedVouchers([...claimedVouchers, voucher.id])
        setClaimingVoucher(null)
        return
      }

      // Insert voucher usage
      const { error: insertError } = await supabase
        .from('voucher_usage')
        .insert({
          user_id: currentSession.user.id,
          voucher_id: voucher.id,
          voucher_code: voucher.code,
          discount_amount: 0,
          free_shipping: voucher.type === 'free_shipping'
        })

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(insertError.message || 'Failed to claim voucher')
      }

      // Update voucher usage count
      const { error: updateError } = await supabase
        .from('vouchers')
        .update({ used_count: (voucherData.used_count || 0) + 1 })
        .eq('id', voucher.id)

      if (updateError) {
        console.error('Update error:', updateError)
      }

      // Update local state
      setClaimedVouchers([...claimedVouchers, voucher.id])
      
      // Create notification
      try {
        await supabase.from('notifications').insert({
          user_id: currentSession.user.id,
          title: 'Voucher Claimed! 🎉',
          message: `You've successfully claimed ${voucher.type === 'percentage' ? `${voucher.value}% OFF` : voucher.type === 'fixed' ? `₱${voucher.value.toLocaleString()} OFF` : 'Free Shipping'} voucher. Use it at checkout!`,
        })
      } catch (notifError) {
        console.error('Notification error:', notifError)
      }

      setShowVoucherAlert({ 
        show: true, 
        message: `Successfully claimed ${voucher.type === 'percentage' ? `${voucher.value}% OFF` : voucher.type === 'fixed' ? `₱${voucher.value.toLocaleString()} OFF` : 'Free Shipping'} voucher! 🎉`, 
        type: 'success' 
      })
      
      // Refresh vouchers to update available count
      await fetchVouchers()
      
    } catch (error: any) {
      console.error('Error claiming voucher:', error)
      setShowVoucherAlert({ 
        show: true, 
        message: error.message || 'Failed to claim voucher. Please try again.', 
        type: 'error' 
      })
    } finally {
      setClaimingVoucher(null)
    }
  }

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault()

    if (product.stock === 0) {
      alert('Sorry, this product is out of stock!')
      return
    }

    if (addingStates.get(product.id)) return

    setAddingStates((prev) => new Map(prev).set(product.id, true))

    const finalPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price

    const cartItem = {
      id: product.id,
      name: product.name,
      price: Number(finalPrice),
      image: productImages.get(product.id) || '/placeholder-product.png',
      quantity: 1,
      stock: product.stock,
    }

    await addToCart(cartItem)

    setTimeout(() => {
      setAddingStates((prev) => new Map(prev).set(product.id, false))
    }, 1000)
  }

  const handleBuyNow = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const { data: { session: currentSession } } = await supabase.auth.getSession()
    
    if (!currentSession) {
      router.push(`/login?redirect=/products/${product.slug}`)
      return
    }

    if (product.stock === 0) {
      alert('Sorry, this product is out of stock!')
      return
    }

    if (buyingStates.get(product.id)) return

    setBuyingStates((prev) => new Map(prev).set(product.id, true))

    try {
      const finalPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price

      const checkoutSummary = {
        items: [{
          id: product.id,
          name: product.name,
          price: Number(finalPrice),
          originalPrice: product.price,
          image: productImages.get(product.id) || '/placeholder-product.png',
          quantity: 1,
          stock: product.stock,
          is_on_sale: product.is_on_sale,
          discount_percent: product.discount_percent,
          brand: product.brand
        }],
        subtotal: Number(finalPrice),
        shippingFee: 0,
        address: null,
        isSingleItem: true
      }
      
      localStorage.setItem('checkoutSummary', JSON.stringify(checkoutSummary))
      sessionStorage.setItem('checkoutProduct', JSON.stringify(checkoutSummary.items[0]))
      
      setTimeout(() => {
        router.push('/checkout')
      }, 100)
      
    } catch (error) {
      console.error('Buy now error:', error)
      alert('Something went wrong. Please try again.')
    } finally {
      setTimeout(() => {
        setBuyingStates((prev) => new Map(prev).set(product.id, false))
      }, 1000)
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)
    
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        ))}
        {hasHalfStar && (
          <div className="relative">
            <Star className="h-3 w-3 text-gray-300" />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            </div>
          </div>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300" />
        ))}
      </div>
    )
  }

  const getVoucherIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="h-4 w-4" />
      case 'free_shipping':
        return <Truck className="h-4 w-4" />
      default:
        return <Tag className="h-4 w-4" />
    }
  }

  const getVoucherBadge = (type: string, value: number) => {
    switch (type) {
      case 'percentage':
        return `${value}% OFF`
      case 'fixed':
        return `₱${value.toLocaleString()} OFF`
      case 'free_shipping':
        return 'FREE SHIPPING'
      default:
        return 'DISCOUNT'
    }
  }

  // Check if a voucher is expired
  const isVoucherExpired = (voucher: Voucher) => {
    const now = new Date()
    const validUntil = new Date(voucher.valid_until)
    return now > validUntil
  }

  const saleCount = filteredProducts.filter((p) => p.is_on_sale).length

  // PAGINATION LOGIC
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE
    const end = start + PRODUCTS_PER_PAGE
    return filteredProducts.slice(start, end)
  }, [filteredProducts, currentPage])

  const ProductCard = ({ product }: { product: Product }) => {
    const image = productImages.get(product.id) || '/placeholder-product.png'
    const isWishlisted = wishlist.includes(product.id)
    const isAdding = addingStates.get(product.id)
    const isBuying = buyingStates.get(product.id)
    const displayPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price
    const originalPrice = product.price
    const isOutOfStock = product.stock === 0
    const isLowStock = product.stock > 0 && product.stock <= 10
    const rating = productRatings.get(product.id)
    const averageRating = rating?.average_rating || 0
    const reviewCount = rating?.review_count || 0

    return (
      <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-gray-100">
          <img src={image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />

          {product.is_on_sale && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
              <Zap className="h-3 w-3" />
              -{product.discount_percent}% OFF
            </div>
          )}

          {isOutOfStock && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
              <span className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Out of Stock</span>
            </div>
          )}

          <button
            onClick={(e) => toggleWishlist(product.id, e)}
            className="absolute right-3 top-3 rounded-full bg-white p-2 shadow-md transition hover:bg-gray-100 z-10"
            disabled={isOutOfStock}
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
          </button>
        </Link>

        <div className="space-y-3 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{product.brand || 'ROCARS'}</p>
            <Link href={`/products/${product.slug}`}>
              <h3 className="mt-1 line-clamp-2 min-h-[48px] text-sm font-medium text-black transition hover:text-yellow-600">
                {product.name}
              </h3>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {renderStars(averageRating)}
            {reviewCount > 0 ? (
              <span className="text-xs text-gray-500">({reviewCount})</span>
            ) : (
              <span className="text-xs text-gray-400">No reviews yet</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isOutOfStock ? (
                <>
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span className="text-xs font-medium text-red-500">Out of Stock</span>
                </>
              ) : isLowStock ? (
                <>
                  <Package className="h-3 w-3 text-orange-500" />
                  <span className="text-xs font-medium text-orange-500">Only {product.stock} left!</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-xs font-medium text-green-600">In Stock</span>
                </>
              )}
            </div>
          </div>

          <div>
            {product.is_on_sale && product.sale_price ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-red-600">{formatPrice(displayPrice)}</span>
                <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</span>
              </div>
            ) : (
              <span className="text-lg font-bold text-black">{formatPrice(displayPrice)}</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={(e) => handleAddToCart(product, e)}
              data-action="add-to-cart"
              disabled={isAdding || isOutOfStock}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
                isOutOfStock ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-black text-white hover:bg-yellow-400 hover:text-black'
              }`}
            >
              {isAdding ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Add
                </>
              )}
            </button>

            <button
              onClick={(e) => handleBuyNow(product, e)}
              disabled={isOutOfStock || isBuying}
              className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                isOutOfStock ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300 text-black hover:border-yellow-400 hover:text-yellow-600'
              }`}
            >
              {isBuying ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                'Buy'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f4]">
        <div className="text-gray-600">Loading products...</div>
      </div>
    )
  }

  // Filter only non-expired vouchers for display
  const availableVouchers = vouchers.filter(v => !isVoucherExpired(v))

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-black">
      {/* Alert Toast */}
      {showVoucherAlert.show && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${
            showVoucherAlert.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {showVoucherAlert.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="text-sm font-medium">{showVoucherAlert.message}</span>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="overflow-hidden rounded-3xl bg-black p-8 text-white lg:p-12">
              <span className="rounded-full bg-yellow-400 px-4 py-1 text-xs font-semibold text-black">ROCARS Quality Products</span>
              <h1 className="mt-6 max-w-xl text-4xl font-black leading-tight lg:text-6xl">
                Your One-Stop
                <span className="block text-yellow-400">Automotive Shop</span>
              </h1>
              <p className="mt-5 max-w-lg text-gray-300">Discover premium automotive parts with a modern shopping experience.</p>
            </div>
            <div className="overflow-hidden rounded-3xl bg-white">
              <img src="/car.png" alt="Car" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* VOUCHERS SECTION - Only show if there are available vouchers */}
      {availableVouchers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-bold text-black">Available Vouchers</h2>
            </div>
            <button 
              onClick={() => setIsVoucherModalOpen(true)} 
              className="text-xs text-yellow-600 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableVouchers.slice(0, 3).map((voucher) => {
              const isClaimed = claimedVouchers.includes(voucher.id)
              
              return (
                <div key={voucher.id} className="bg-gradient-to-r from-yellow-50 to-white rounded-2xl border border-yellow-200 p-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0">
                    <Sparkles className="h-16 w-16 text-yellow-200 opacity-50 -rotate-12" />
                  </div>
                  
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-yellow-100">
                          {getVoucherIcon(voucher.type)}
                        </div>
                        <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                          {getVoucherBadge(voucher.type, voucher.value)}
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-black text-sm">
                        {voucher.type === 'percentage' && `${voucher.value}% OFF`}
                        {voucher.type === 'fixed' && `₱${voucher.value.toLocaleString()} OFF`}
                        {voucher.type === 'free_shipping' && 'Free Shipping'}
                      </h3>
                      
                      {voucher.description && (
                        <p className="text-xs text-gray-500 mt-1">{voucher.description}</p>
                      )}
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {voucher.min_spend > 0 && (
                          <span>Min. Spend ₱{voucher.min_spend.toLocaleString()}</span>
                        )}
                        {voucher.max_discount && voucher.type === 'percentage' && (
                          <span>Max ₱{voucher.max_discount.toLocaleString()}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>Expires: {new Date(voucher.valid_until).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleClaimVoucher(voucher, e)}
                      disabled={isClaimed || claimingVoucher === voucher.id}
                      className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                        isClaimed
                          ? 'bg-green-100 text-green-600 cursor-default'
                          : claimingVoucher === voucher.id
                          ? 'bg-yellow-200 text-yellow-700'
                          : 'bg-yellow-400 text-black hover:bg-yellow-500'
                      }`}
                    >
                      {claimingVoucher === voucher.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      ) : isClaimed ? (
                        'Claimed ✓'
                      ) : (
                        'Claim'
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* FLOATING VOUCHER MODAL - Only show if there are available vouchers */}
      {isVoucherModalOpen && availableVouchers.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-3xl w-full max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-bold text-black">All Available Vouchers</h2>
              </div>
              <button 
                onClick={() => setIsVoucherModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="overflow-y-auto p-6 max-h-[calc(85vh-70px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableVouchers.map((voucher) => {
                  const isClaimed = claimedVouchers.includes(voucher.id)
                  
                  return (
                    <div key={voucher.id} className="bg-gradient-to-r from-yellow-50 to-white rounded-2xl border border-yellow-200 p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0">
                        <Sparkles className="h-16 w-16 text-yellow-200 opacity-50 -rotate-12" />
                      </div>
                      
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-yellow-100">
                              {getVoucherIcon(voucher.type)}
                            </div>
                            <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                              {getVoucherBadge(voucher.type, voucher.value)}
                            </span>
                          </div>
                          
                          <h3 className="font-bold text-black text-sm">
                            {voucher.type === 'percentage' && `${voucher.value}% OFF`}
                            {voucher.type === 'fixed' && `₱${voucher.value.toLocaleString()} OFF`}
                            {voucher.type === 'free_shipping' && 'Free Shipping'}
                          </h3>
                          
                          {voucher.description && (
                            <p className="text-xs text-gray-500 mt-1">{voucher.description}</p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            {voucher.min_spend > 0 && (
                              <span>Min. Spend ₱{voucher.min_spend.toLocaleString()}</span>
                            )}
                            {voucher.max_discount && voucher.type === 'percentage' && (
                              <span>Max ₱{voucher.max_discount.toLocaleString()}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>Expires: {new Date(voucher.valid_until).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => handleClaimVoucher(voucher, e)}
                          disabled={isClaimed || claimingVoucher === voucher.id}
                          className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                            isClaimed
                              ? 'bg-green-100 text-green-600 cursor-default'
                              : claimingVoucher === voucher.id
                              ? 'bg-yellow-200 text-yellow-700'
                              : 'bg-yellow-400 text-black hover:bg-yellow-500'
                          }`}
                        >
                          {claimingVoucher === voucher.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                          ) : isClaimed ? (
                            'Claimed ✓'
                          ) : (
                            'Claim'
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="rounded-2xl border border-gray-200 bg-white p-5">
                <Icon className="mb-3 h-6 w-6 text-yellow-500" />
                <h3 className="font-semibold text-black">{feature.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{feature.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-black">Shop by Category</h2>
          {selectedCategory && (
            <button onClick={() => handleCategoryClick(null)} className="text-sm text-yellow-600 hover:underline">
              Clear Filter
            </button>
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          <div className="shrink-0 w-24">
            <button
              onClick={() => handleCategoryClick(null)}
              className={`group w-full overflow-hidden rounded-2xl transition-all duration-300 ${
                !selectedCategory ? 'ring-2 ring-black shadow-lg' : 'hover:shadow-md hover:-translate-y-1'
              }`}
            >
              <div className="aspect-square bg-gradient-to-br from-gray-900 to-black flex items-center justify-center text-white">
                <Package className="h-6 w-6" />
              </div>
            </button>
            <p className="mt-3 text-center text-sm font-medium text-gray-800">All</p>
          </div>

          {categories.map((category) => (
            <div key={category.id} className="shrink-0 w-24">
              <button
                onClick={() => handleCategoryClick(category.slug)}
                className={`group relative w-full overflow-hidden rounded-2xl transition-all duration-300 ${
                  selectedCategory === category.slug ? 'ring-2 ring-black shadow-lg' : 'hover:shadow-md hover:-translate-y-1'
                }`}
              >
                <div className="aspect-square overflow-hidden bg-gray-100">
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-200">
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>
              </button>
              <p className="mt-3 line-clamp-2 text-center text-sm font-medium text-gray-800">{category.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-yellow-500" />
            <div>
              <h2 className="text-2xl font-bold text-black">
                {selectedCategory ? categories.find((c) => c.slug === selectedCategory)?.name || 'Products' : 'All Products'}
              </h2>
              <p className="text-sm text-gray-500">
                Showing {filteredProducts.length} of {products.length} products
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
            <label className="relative block w-full sm:w-96">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                data-voice-search
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search parts, brands, categories..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-black shadow-sm transition focus:border-black focus:ring-2 focus:ring-black/10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  aria-label="Clear product search"
                  className="absolute right-2 top-1/2 rounded-lg p-1.5 text-gray-400 transition -translate-y-1/2 hover:bg-gray-100 hover:text-black"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>

            {(searchQuery || selectedCategory) && (
              <button
                type="button"
                onClick={clearProductFilters}
                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:border-black hover:text-black"
              >
                Clear
              </button>
            )}

            {saleCount > 0 && (
              <div className="flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-red-50 px-4 text-sm">
                <Gift className="h-4 w-4 text-red-500" />
                <span className="text-gray-600">{saleCount} on sale</span>
              </div>
            )}
          </div>
        </div>

        {searchQuery && (
          <div className="mb-5 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            Search results for <span className="font-semibold">{searchQuery}</span>
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500">
              Try searching a different product, brand, or category.
            </p>
            <button
              type="button"
              onClick={clearProductFilters}
              className="mt-5 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Reset search
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-8">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-16 pt-4 flex flex-wrap items-center justify-center gap-2 border-t border-gray-200">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-black disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-11 w-11 rounded-xl text-sm font-semibold transition ${
                      currentPage === page ? 'bg-black text-white' : 'border border-gray-300 bg-white hover:border-black'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-black disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <Footer />
    </main>
  )
}
