'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Star, ShoppingCart, Heart, Share2, Truck, ShieldCheck, RefreshCw, ChevronLeft, Minus, Plus, CheckCircle, Package, AlertCircle } from 'lucide-react'

interface Product {
  id: number
  name: string
  slug: string
  description: string
  brand: string
  price: number
  sale_price: number | null
  stock: number
  sku: string
  is_active: boolean
  category_id: number
  created_at: string
  is_on_sale?: boolean
  discount_percent?: number | null
}

interface ProductImage {
  id: number
  product_id: number
  image_url: string
  is_primary: boolean
}

interface Review {
  id: number
  product_id: number
  rating: number
  comment: string
  user_name: string
  created_at: string
}

export default function ProductDetailPage() {
  const params = useParams()
  const slug = (params as any).slug as string

  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details')
  const [addingToCart, setAddingToCart] = useState(false)
  const [session, setSession] = useState<any>(null)

  // Fetch product data
  useEffect(() => {
    if (slug) fetchProduct()
  }, [slug])

  // Load wishlist status
  useEffect(() => {
    if (product) {
      checkAuth()
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]')
      setIsWishlisted(wishlist.includes(product.id))
    }
  }, [product])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setSession(session)
  }

  const fetchProduct = async () => {
    setLoading(true)
    setError(null)

    try {
      // First, get the product by slug
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (productError) {
        console.error('Product fetch error:', productError)
        setError('Product not found')
        setLoading(false)
        return
      }

      if (!productData) {
        setError('Product not found')
        setLoading(false)
        return
      }
      
      setProduct(productData)

      // Fetch images for this product - try without ordering first
      const { data: imageData, error: imageError } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productData.id)

      if (imageError) {
        console.error('Image fetch error:', imageError)
        // Try alternative table name
        const { data: altImageData } = await supabase
          .from('product_image')
          .select('*')
          .eq('product_id', productData.id)
        
        if (altImageData && altImageData.length > 0) {
          setImages(altImageData)
          setSelectedImage(altImageData[0].image_url)
        }
      } else {
        setImages(imageData || [])
        if (imageData && imageData.length > 0) {
          setSelectedImage(imageData[0].image_url)
        }
      }

      // Fetch reviews through an API route so public product pages do not depend on browser RLS.
      const reviewResponse = await fetch(`/api/products/${productData.id}/reviews`)
      if (reviewResponse.ok) {
        const reviewResult = await reviewResponse.json()
        setReviews(reviewResult.reviews || [])
      } else {
        setReviews([])
      }

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const addToCart = async () => {
    if (!product) return
    
    setAddingToCart(true)
    
    const cart = JSON.parse(localStorage.getItem('cart') || '[]')
    const existing = cart.find((item: any) => item.id === product.id)

    const finalPrice = product.sale_price || product.price

    if (existing) {
      existing.quantity += quantity
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: finalPrice,
        image: images[0]?.image_url || null,
        quantity: quantity,
        stock: product.stock
      })
    }

    localStorage.setItem('cart', JSON.stringify(cart))
    window.dispatchEvent(new Event('cartUpdated'))
    
    setTimeout(() => setAddingToCart(false), 500)
  }

  const handleBuyNow = async () => {
    if (!product) return

    if (!session) {
      window.location.href = `/login?redirect=/products/${product.slug}`
      return
    }

    const finalPrice = product.sale_price || product.price

    const checkoutSummary = {
      items: [{
        id: product.id,
        name: product.name,
        price: Number(finalPrice),
        originalPrice: product.price,
        image: images[0]?.image_url || null,
        quantity: quantity,
        stock: product.stock,
        is_on_sale: product.is_on_sale,
        discount_percent: product.discount_percent,
        brand: product.brand
      }],
      subtotal: Number(finalPrice) * quantity,
      shippingFee: 0,
      address: null,
      isSingleItem: true
    }
    
    localStorage.setItem('checkoutSummary', JSON.stringify(checkoutSummary))
    sessionStorage.setItem('checkoutProduct', JSON.stringify(checkoutSummary.items[0]))
    
    window.location.href = '/checkout'
  }

  const toggleWishlist = async () => {
    if (!product) return
    
    if (!session) {
      window.location.href = '/login'
      return
    }
    
    let newWishlist: number[]
    
    if (isWishlisted) {
      await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', session.user.id)
        .eq('product_id', product.id)
      
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]')
      newWishlist = wishlist.filter((id: number) => id !== product.id)
    } else {
      await supabase.from('wishlists').insert({
        user_id: session.user.id,
        product_id: product.id,
      })
      
      newWishlist = [...JSON.parse(localStorage.getItem('wishlist') || '[]'), product.id]
    }
    
    setIsWishlisted(!isWishlisted)
    localStorage.setItem('wishlist', JSON.stringify(newWishlist))
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(price)

  const calculateAverageRating = () => {
    if (reviews.length === 0) return 0
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
    return sum / reviews.length
  }

  const renderStars = (rating: number, size: string = 'w-5 h-5') => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <div className="flex items-center gap-1">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className={`${size} fill-yellow-400 text-yellow-400`} />
        ))}
        {hasHalfStar && (
          <div className="relative">
            <Star className={`${size} text-gray-300`} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className={`${size} fill-yellow-400 text-yellow-400`} />
            </div>
          </div>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className={`${size} text-gray-300`} />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-gray-200 rounded-xl h-96"></div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24">
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="text-6xl mb-4">No results</div>
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-gray-500 mb-6">{error || "The product you're looking for doesn't exist."}</p>
          <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition">
            <ChevronLeft className="w-4 h-4" />
            Back to Products
          </Link>
        </div>
      </div>
    )
  }

  const avgRating = calculateAverageRating()
  const displayPrice = product.sale_price || product.price
  const originalPrice = product.price
  const hasDiscount = !!product.sale_price && product.sale_price < product.price

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Breadcrumb */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-black transition">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-black transition">Products</Link>
            <span>/</span>
            <span className="text-black font-medium">{product.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Left Column - Images */}
          <div>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 mb-4 shadow-sm">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="w-full h-auto object-cover"
                  onError={(e) => {
                    // Use data URL fallback
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1"%3E%3Crect x="2" y="2" width="20" height="20" rx="2" fill="%23f3f4f6"/%3E%3Cpath d="M8 10h.01M16 10h.01M8 16h8" stroke-linecap="round"/%3E%3C/svg%3E'
                  }}
                />
              ) : (
                <div className="w-full h-96 flex items-center justify-center bg-gray-100">
                  <Package className="w-16 h-16 text-gray-400" />
                </div>
              )}
            </div>
            
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((image, idx) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(image.image_url)}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition ${
                      selectedImage === image.image_url ? 'border-black ring-2 ring-black/20' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <img 
                      src={image.image_url} 
                      alt={`${product.name} - ${idx + 1}`} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23999"%3E%3Crect x="2" y="2" width="20" height="20" rx="2" fill="%23f3f4f6"/%3E%3C/svg%3E'
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Product Info */}
          <div>
            <div className="mb-2">
              <span className="text-xs uppercase tracking-wide text-gray-400 font-medium">{product.brand || 'ROCARS'}</span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">
              {product.name}
            </h1>
            
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400">SKU: {product.sku || 'N/A'}</span>
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              {renderStars(avgRating)}
              <span className="text-sm text-gray-500">
                ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
              </span>
            </div>
            
            {/* Price Section */}
            <div className="mb-4">
              {hasDiscount ? (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-red-600">
                    {formatPrice(displayPrice)}
                  </span>
                  <span className="text-xl text-gray-400 line-through">
                    {formatPrice(originalPrice)}
                  </span>
                  {product.discount_percent && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      -{product.discount_percent}%
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-3xl font-bold text-black">
                  {formatPrice(displayPrice)}
                </span>
              )}
            </div>
            
            <div className="mb-4">
              {product.stock > 10 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">In Stock</span>
                </div>
              ) : product.stock > 0 ? (
                <div className="flex items-center gap-2 text-orange-600">
                  <Package className="w-4 h-4" />
                  <span className="text-sm font-medium">Only {product.stock} left in stock</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Out of Stock</span>
                </div>
              )}
            </div>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              {product.description}
            </p>
            
            {product.stock > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:border-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-medium text-black">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                    className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:border-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-500 ml-2">Max {product.stock}</span>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 mb-6">
              <button
                onClick={addToCart}
                disabled={product.stock <= 0 || addingToCart}
                className={`flex-1 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                  product.stock <= 0 
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                    : 'bg-black text-white hover:bg-yellow-400 hover:text-black'
                }`}
              >
                {addingToCart ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </>
                )}
              </button>
              
              <button 
                onClick={toggleWishlist} 
                className="px-4 py-3 border border-gray-300 rounded-xl hover:border-black transition"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
              </button>
              
              {typeof navigator !== 'undefined' && navigator.share && (
                <button 
                  onClick={() => navigator.share?.({ title: product.name, text: product.description, url: window.location.href })} 
                  className="px-4 py-3 border border-gray-300 rounded-xl hover:border-black transition"
                >
                  <Share2 className="w-5 h-5 text-gray-600" />
                </button>
              )}
            </div>
            
            {product.stock > 0 && (
              <button
                onClick={handleBuyNow}
                className="w-full py-3 text-center border-2 border-black text-black font-medium rounded-xl hover:bg-black hover:text-white transition duration-300 mb-6"
              >
                Buy Now
              </button>
            )}
            
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Truck className="w-5 h-5 text-gray-400" />
                <span>Free shipping on orders over ₱2,000</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <ShieldCheck className="w-5 h-5 text-gray-400" />
                <span>2-year warranty on all products</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <RefreshCw className="w-5 h-5 text-gray-400" />
                <span>30-day easy returns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-12">
          <div className="border-b border-gray-200">
            <div className="flex gap-6">
              <button 
                onClick={() => setActiveTab('details')} 
                className={`pb-3 text-sm font-medium transition ${
                  activeTab === 'details' 
                    ? 'text-black border-b-2 border-black' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Product Details
              </button>
              <button 
                onClick={() => setActiveTab('reviews')} 
                className={`pb-3 text-sm font-medium transition ${
                  activeTab === 'reviews' 
                    ? 'text-black border-b-2 border-black' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Reviews ({reviews.length})
              </button>
            </div>
          </div>

          <div className="py-6">
            {activeTab === 'details' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-black">Product Description</h3>
                <p className="text-gray-600 leading-relaxed">{product.description}</p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {reviews.length === 0 ? (
                  <div className="text-center py-8 bg-white rounded-xl border border-gray-100">
                    <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No reviews yet. Be the first to review this product!</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-black">{avgRating.toFixed(1)}</div>
                          {renderStars(avgRating, 'w-5 h-5')}
                          <div className="text-sm text-gray-500 mt-2">Based on {reviews.length} reviews</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div key={review.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition">
                          <div className="flex items-center justify-between mb-2">
                            <div>{renderStars(review.rating, 'w-4 h-4')}</div>
                            <span className="text-xs text-gray-400">
                              {new Date(review.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mt-2">{review.comment}</p>
                          <p className="text-xs text-gray-400 mt-3">— {review.user_name || 'Verified Buyer'}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Related Products Section */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-xl font-bold text-black mb-4">You Might Also Like</h2>
          <Link 
            href="/products" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-black transition group"
          >
            View all products 
            <ChevronLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition" />
          </Link>
        </div>
      </div>
    </div>
  )
}
