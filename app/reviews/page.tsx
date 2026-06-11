// app/reviews/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PageContainer from '@/components/layout/PageContainer'
import PageSection from '@/components/layout/PageSection'
import Link from 'next/link'
import {
  Star,
  Package,
  Calendar,
  MessageSquare,
  Send,
  AlertCircle,
  CheckCircle,
  XCircle,
  ShoppingBag,
  User,
  Shield,
  Users,
  HelpCircle,
} from 'lucide-react'

interface OrderItem {
  id: number
  product_id: number
  quantity: number
  price: number
  order_id?: number  // Make order_id optional since it might not come from the nested query
  products: {
    id: number
    name: string
    slug: string
    brand?: string
  }
}

interface Order {
  id: number
  created_at: string
  delivered_at: string | null
  order_items: OrderItem[]
}

interface Review {
  id: number
  product_id: number
  rating: number
  comment: string
  created_at: string
}

export default function ReviewsPage() {
  const router = useRouter()
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [existingReviews, setExistingReviews] = useState<Map<number, Review>>(new Map())
  const [showModal, setShowModal] = useState(false)
  const [userName, setUserName] = useState('')
  const [productImages, setProductImages] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    loadDeliveredOrders()
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, username')
        .eq('id', session.user.id)
        .single()
      
      if (profile) {
        const name = profile.first_name 
          ? `${profile.first_name} ${profile.last_name || ''}`.trim()
          : profile.username || 'User'
        setUserName(name)
      }
    }
  }

  const loadProductImages = async (productIds: number[]) => {
    if (productIds.length === 0) return
    
    const { data: images, error } = await supabase
      .from('product_images')
      .select('product_id, image_url')
      .in('product_id', productIds)

    if (!error && images) {
      const imageMap = new Map<number, string>()
      images.forEach(img => {
        if (!imageMap.has(img.product_id)) {
          imageMap.set(img.product_id, img.image_url)
        }
      })
      setProductImages(imageMap)
    }
  }

  const loadDeliveredOrders = async () => {
    try {
      setLoading(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login?redirect=/reviews')
        return
      }

      // Fetch delivered orders with items
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          delivered_at,
          order_items!inner (
            id,
            product_id,
            quantity,
            price,
            products!inner (
              id,
              name,
              slug,
              brand
            )
          )
        `)
        .eq('user_id', session.user.id)
        .eq('order_status', 'delivered')
        .order('delivered_at', { ascending: false })

      if (ordersError) {
        console.error('Orders error:', ordersError)
        throw ordersError
      }

      if (!orders || orders.length === 0) {
        setDeliveredOrders([])
        setLoading(false)
        return
      }

      // Transform orders to match Order interface
      const transformedOrders: Order[] = orders.map(order => ({
        id: order.id,
        created_at: order.created_at,
        delivered_at: order.delivered_at,
        order_items: order.order_items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          products: item.products && item.products.length > 0 ? item.products[0] : {
            id: item.product_id,
            name: 'Product',
            slug: '',
            brand: null
          }
        }))
      }))

      // Get all product IDs to fetch images
      const productIds = transformedOrders.flatMap(order => 
        order.order_items.map(item => item.product_id)
      )

      // Fetch product images
      await loadProductImages(productIds)

      // Fetch existing reviews for these products
      if (productIds.length > 0) {
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('*')
          .eq('user_id', session.user.id)
          .in('product_id', productIds)

        if (!reviewsError && reviews) {
          const reviewMap = new Map()
          reviews.forEach(review => {
            reviewMap.set(review.product_id, review)
          })
          setExistingReviews(reviewMap)
        }
      }

      setDeliveredOrders(transformedOrders)
    } catch (error) {
      console.error('Error loading delivered orders:', error)
      setErrorMessage('Failed to load orders. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const openReviewModal = (product: any, orderId: number) => {
    const existingReview = existingReviews.get(product.id)
    if (existingReview) {
      setErrorMessage('You have already reviewed this product.')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }
    
    setSelectedProduct({ ...product, order_id: orderId })
    setRating(0)
    setHoverRating(0)
    setComment('')
    setShowModal(true)
  }

  const submitReview = async () => {
    // Validate rating
    if (rating === 0) {
      setErrorMessage('Please rate the product (1-5 stars)')
      return
    }

    if (!comment.trim()) {
      setErrorMessage('Please write a review comment')
      return
    }

    if (comment.length < 10) {
      setErrorMessage('Please write at least 10 characters for your review')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          user_id: session.user.id,
          product_id: selectedProduct.id,
          rating: rating,
          comment: comment.trim(),
          created_at: new Date().toISOString()
        })

      if (reviewError) {
        console.error('Review insert error:', reviewError)
        throw reviewError
      }

      // Add notification for admin about new review
      await supabase.from('notifications').insert({
        user_id: session.user.id,
        title: 'New Product Review',
        message: `${userName} reviewed ${selectedProduct.name} with ${rating} stars`,
        is_read: false,
        type: 'review'
      })

      // Update local state
      const newReview: Review = {
        id: Date.now(),
        product_id: selectedProduct.id,
        rating: rating,
        comment: comment.trim(),
        created_at: new Date().toISOString()
      }
      setExistingReviews(prev => new Map(prev).set(selectedProduct.id, newReview))

      setSuccessMessage(`Thank you for reviewing ${selectedProduct.name}!`)
      setTimeout(() => setSuccessMessage(null), 3000)
      
      setShowModal(false)
      setSelectedProduct(null)
      setRating(0)
      setComment('')
    } catch (error: any) {
      console.error('Error submitting review:', error)
      setErrorMessage(error.message || 'Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (rating: number, size: string = 'w-5 h-5') => {
    const fullStars = Math.floor(rating)
    const emptyStars = 5 - fullStars

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className={`${size} fill-yellow-400 text-yellow-400`} />
        ))}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className={`${size} text-gray-300`} />
        ))}
      </div>
    )
  }

  const renderInteractiveStars = () => {
    const displayRating = hoverRating || rating
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          onClick={() => setRating(i)}
          onMouseEnter={() => setHoverRating(i)}
          onMouseLeave={() => setHoverRating(0)}
          className="cursor-pointer transition-transform hover:scale-110 focus:outline-none"
        >
          {i <= displayRating ? (
            <Star className="w-8 h-8 fill-yellow-400 text-yellow-400" />
          ) : (
            <Star className="w-8 h-8 text-gray-300" />
          )}
        </button>
      )
    }
    return <div className="flex gap-1 justify-center">{stars}</div>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <PageSection>
        <PageContainer size="lg">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading your orders...</p>
            </div>
          </div>
        </PageContainer>
      </PageSection>
    )
  }

  return (
    <PageSection>
      <PageContainer size="lg">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Product Reviews</h1>
          <p className="text-gray-500 mt-2">
            Share your honest feedback about products you've purchased
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-auto">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {deliveredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No delivered orders yet</h2>
            <p className="text-gray-500 mb-6">
              You can review products once your orders are delivered.
            </p>
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-black rounded-xl font-semibold hover:bg-yellow-500 transition"
            >
              <ShoppingBag className="w-5 h-5" />
              View My Orders
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {deliveredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Order Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-gray-900">Order #{order.id}</h2>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Delivered: {order.delivered_at ? formatDate(order.delivered_at) : formatDate(order.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        Delivered
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="divide-y divide-gray-100">
                  {order.order_items.map((item) => {
                    const hasReviewed = existingReviews.has(item.product_id)
                    const review = existingReviews.get(item.product_id)
                    const productImage = productImages.get(item.product_id) || '/placeholder-product.png'
                    
                    return (
                      <div key={item.id} className="p-6 hover:bg-gray-50 transition">
                        <div className="flex gap-4">
                          {/* Product Image */}
                          <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                            <img 
                              src={productImage} 
                              alt={item.products.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-product.png'
                              }}
                            />
                          </div>

                          {/* Product Info */}
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                              <div>
                                <h3 className="font-semibold text-gray-900 text-lg">
                                  {item.products.name}
                                </h3>
                                {item.products.brand && (
                                  <p className="text-sm text-gray-500 mt-1">Brand: {item.products.brand}</p>
                                )}
                                <p className="text-sm text-gray-500 mt-1">
                                  Quantity: {item.quantity} × ₱{Number(item.price).toLocaleString()}
                                </p>
                              </div>

                              <div>
                                {hasReviewed ? (
                                  <div className="text-center">
                                    <div className="mb-2">
                                      {renderStars(review?.rating || 0)}
                                    </div>
                                    <span className="text-sm text-green-600 flex items-center gap-1">
                                      <CheckCircle className="w-4 h-4" />
                                      Reviewed
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => openReviewModal(item.products, order.id)}
                                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-yellow-400 hover:text-black transition font-medium text-sm flex items-center gap-2"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    Write a Review
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Existing Review Display */}
                            {hasReviewed && review && (
                              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <div className="shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                      <User className="w-5 h-5 text-gray-500" />
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div>
                                        <p className="font-medium text-gray-900">
                                          {userName}
                                        </p>
                                        {renderStars(review.rating)}
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        {formatDate(review.created_at)}
                                      </span>
                                    </div>
                                    <p className="text-gray-700 mt-2">{review.comment}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Review Modal */}
        {showModal && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Write a Review</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition"
                >
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="p-6">
                {/* Product Info */}
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">{selectedProduct.name}</h3>
                  {selectedProduct.brand && (
                    <p className="text-sm text-gray-500 mt-1">Brand: {selectedProduct.brand}</p>
                  )}
                </div>

                {/* Rating Stars */}
                <div className="mb-6 text-center">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Overall Rating <span className="text-red-500">*</span>
                  </label>
                  {renderInteractiveStars()}
                  <p className="text-xs text-gray-500 mt-2">
                    Click on the stars to rate (1 = Poor, 5 = Excellent)
                  </p>
                </div>

                {/* Review Comment */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Your Review <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none"
                    placeholder="Share your experience with this product... What did you like or dislike?"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-500">
                      {comment.length}/1000 characters
                    </p>
                    {comment.length > 0 && comment.length < 10 && (
                      <p className="text-xs text-red-500">Minimum 10 characters</p>
                    )}
                  </div>
                </div>

                {/* Tips */}
                <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-700 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    <strong>Review Tips:</strong> Be specific about your experience, mention what you liked or disliked.
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <button
                    onClick={submitReview}
                    disabled={submitting}
                    className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-yellow-400 hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Review
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </PageSection>
  )
}