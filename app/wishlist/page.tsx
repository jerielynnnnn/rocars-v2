'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import Footer from '@/components/Footer'
import {
  ShoppingCart,
  Heart,
  Trash2,
  ArrowLeft,
  ShoppingBag,
  Star,
  X,
} from 'lucide-react'

interface Product {
  id: number
  name: string
  slug: string
  description: string
  brand: string
  price: number
  stock: number
  sku: string
  is_active: boolean
  category_id: number
  created_at: string
}

export default function WishlistPage() {
  const router = useRouter()
  const { addToCart } = useCart()

  const [wishlistIds, setWishlistIds] = useState<number[]>([])
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([])
  const [productImages, setProductImages] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState<number | null>(null)

  useEffect(() => {
    loadWishlist()
  }, [])

  const loadWishlist = async () => {
    setLoading(true)
    
    // Get wishlist from localStorage
    const saved = localStorage.getItem('wishlist')
    let ids: number[] = []
    
    if (saved) {
      ids = JSON.parse(saved)
      setWishlistIds(ids)
    }
    
    if (ids.length === 0) {
      setWishlistProducts([])
      setLoading(false)
      return
    }
    
    // Fetch products from Supabase
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .eq('is_active', true)
    
    if (!error && data) {
      setWishlistProducts(data)
      
      // Fetch images for these products
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
    }
    
    setLoading(false)
  }

  const removeFromWishlist = (productId: number) => {
    const updated = wishlistIds.filter(id => id !== productId)
    setWishlistIds(updated)
    localStorage.setItem('wishlist', JSON.stringify(updated))
    
    // Update products list
    setWishlistProducts(prev => prev.filter(p => p.id !== productId))
    
    // Dispatch event for navbar to update
    window.dispatchEvent(new Event('wishlistUpdated'))
  }

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault()
    setAddingToCart(product.id)
    
    await addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: productImages.get(product.id) || '/placeholder-product.jpg',
      quantity: 1,
    })
    
    setTimeout(() => setAddingToCart(null), 600)
  }

  const handleBuyNow = (product: Product, e: React.MouseEvent) => {
    e.preventDefault()
    
    localStorage.setItem(
      'direct_checkout',
      JSON.stringify({
        id: product.id,
        name: product.name,
        price: product.price,
        image: productImages.get(product.id) || '/placeholder-product.jpg',
        quantity: 1,
      })
    )
    
    router.push('/checkout')
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)

  const renderStars = () => {
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f6f4]">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-gray-500">Loading your wishlist...</div>
        </div>
        <Footer />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6f6f4]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue Shopping
            </Link>
            <h1 className="mt-4 text-3xl font-bold text-black">My Wishlist</h1>
            <p className="mt-1 text-sm text-gray-500">
              {wishlistProducts.length} {wishlistProducts.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
        </div>

        {/* Empty State */}
        {wishlistProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-20 text-center">
            <div className="rounded-full bg-gray-100 p-4">
              <Heart className="h-12 w-12 text-gray-300" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-black">Your wishlist is empty</h2>
            <p className="mt-2 text-gray-500">Save your favorite items here!</p>
            <Link
              href="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-yellow-400 hover:text-black"
            >
              <ShoppingBag className="h-4 w-4" />
              Browse Products
            </Link>
          </div>
        ) : (
          /* Wishlist Grid */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {wishlistProducts.map((product) => {
              const image = productImages.get(product.id) || '/placeholder-product.jpg'
              const isAdding = addingToCart === product.id
              
              return (
                <div
                  key={product.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Product Image */}
                  <Link href={`/products/${product.slug}`} className="block">
                    <div className="relative aspect-square overflow-hidden bg-gray-100">
                      <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      
                      {/* Remove Button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          removeFromWishlist(product.id)
                        }}
                        className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow-md transition hover:bg-red-50"
                        aria-label="Remove from wishlist"
                      >
                        <Trash2 className="h-4 w-4 text-gray-600 hover:text-red-500" />
                      </button>
                      
                      {/* Stock Badge */}
                      {product.stock === 0 && (
                        <div className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-1 text-xs font-semibold text-white">
                          Out of Stock
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Product Info */}
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      {product.brand}
                    </p>
                    
                    <Link href={`/products/${product.slug}`}>
                      <h3 className="mt-1 line-clamp-2 min-h-[48px] text-sm font-medium text-black transition hover:text-yellow-600">
                        {product.name}
                      </h3>
                    </Link>
                    
                    <div className="mt-2 flex items-center justify-between">
                      {renderStars()}
                      <span className={`text-xs ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
                      </span>
                    </div>
                    
                    <div className="mt-3">
                      <span className="text-lg font-bold text-black">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={(e) => handleAddToCart(product, e)}
                        disabled={isAdding || product.stock === 0}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black py-2.5 text-sm font-medium text-white transition hover:bg-yellow-400 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAdding ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4" />
                            Add to Cart
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={(e) => handleBuyNow(product, e)}
                        disabled={product.stock === 0}
                        className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-black transition hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Suggested Products Section (Optional) */}
        {wishlistProducts.length > 0 && (
          <div className="mt-16">
            <div className="mb-6 border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold text-black">You might also like</h2>
              <p className="mt-1 text-sm text-gray-500">Discover more products tailored for you</p>
            </div>
            
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-black transition hover:border-yellow-400 hover:text-yellow-600"
            >
              Browse All Products
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        )}
      </div>
      
      <Footer />
    </main>
  )
}