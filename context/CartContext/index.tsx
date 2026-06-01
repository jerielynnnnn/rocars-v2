'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export interface CartItem {
  id: number
  name: string
  price: number
  image: string
  quantity: number
}

interface CartContextType {
  cartItems: CartItem[]
  cartCount: number
  cartTotal: number
  addToCart: (item: CartItem) => Promise<boolean>
  removeFromCart: (id: number) => Promise<void>
  updateQuantity: (id: number, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  buyNow: (item?: CartItem) => Promise<void>
  syncCartWithDatabase: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const isSyncingRef = useRef(false)
  const isClearingRef = useRef(false)

  // Check auth status and get user
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
      setUserId(session?.user?.id || null)
      
      if (session?.user?.id) {
        await syncCartWithDatabase()
      }
      setIsInitialized(true)
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setIsLoggedIn(!!session)
        setUserId(session?.user?.id || null)
        
        if (session?.user?.id) {
          await syncCartWithDatabase()
        } else {
          // Clear local cart on logout
          setCartItems([])
          localStorage.removeItem('cart')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Sync cart between localStorage and database
  const syncCartWithDatabase = async () => {
    if (!userId) return
    if (isSyncingRef.current) return

    try {
      isSyncingRef.current = true

      // Get local cart
      const localCartStr = localStorage.getItem('cart')
      const localCart: CartItem[] = localCartStr ? JSON.parse(localCartStr) : []

      // Get database cart
      const { data: dbCart, error } = await supabase
        .from('cart_items')
        .select('product_id, quantity')
        .eq('user_id', userId)

      if (error) {
        console.error('Error fetching cart from DB:', error)
        return
      }

      if (dbCart && dbCart.length > 0) {
        // If database has items, use them (database is source of truth)
        const productIds = dbCart.map(item => item.product_id)
        
        // Fetch product details
        const { data: products } = await supabase
          .from('products')
          .select('id, name, price')
          .in('id', productIds)

        // Fetch product images
        const { data: images } = await supabase
          .from('product_images')
          .select('product_id, image_url')
          .in('product_id', productIds)

        const imageMap = new Map<number, string>()
        images?.forEach(img => {
          if (!imageMap.has(img.product_id)) {
            imageMap.set(img.product_id, img.image_url)
          }
        })

        const syncedCart: CartItem[] = dbCart.map(dbItem => {
          const product = products?.find(p => p.id === dbItem.product_id)
          return {
            id: dbItem.product_id,
            name: product?.name || '',
            price: Number(product?.price) || 0,
            image: imageMap.get(dbItem.product_id) || '/placeholder-product.jpg',
            quantity: dbItem.quantity
          }
        })

        setCartItems(syncedCart)
        localStorage.setItem('cart', JSON.stringify(syncedCart))
      } else if (localCart.length > 0) {
        // If local has items and database doesn't, sync local to database
        for (const item of localCart) {
          await supabase
            .from('cart_items')
            .insert({
              user_id: userId,
              product_id: item.id,
              quantity: item.quantity
            })
        }
        setCartItems(localCart)
      }
    } catch (error) {
      console.error('Error syncing cart:', error)
    } finally {
      isSyncingRef.current = false
    }
  }

  // Save to database whenever cart changes (if logged in)
  const saveToDatabase = useCallback(async (items: CartItem[]) => {
    // Don't save if we're clearing the cart via clearCart function
    if (isClearingRef.current) return
    if (!userId) return
    if (isSyncingRef.current) return

    try {
      isSyncingRef.current = true

      // Delete all existing cart items for this user
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)

      // Insert new cart items
      if (items.length > 0) {
        const cartInserts = items.map(item => ({
          user_id: userId,
          product_id: item.id,
          quantity: item.quantity
        }))
        
        await supabase
          .from('cart_items')
          .insert(cartInserts)
      }
    } catch (error) {
      console.error('Error saving to database:', error)
    } finally {
      isSyncingRef.current = false
    }
  }, [userId])

  // Load cart from localStorage on mount (only once)
  useEffect(() => {
    if (!isInitialized && !isLoggedIn) {
      const savedCart = localStorage.getItem('cart')
      if (savedCart) {
        try {
          setCartItems(JSON.parse(savedCart))
        } catch (e) {
          console.error('Failed to load cart', e)
        }
      }
    }
  }, [isLoggedIn, isInitialized])

  // Save cart to localStorage whenever it changes, but prevent infinite loops
  useEffect(() => {
    // Don't save if this is a clearCart operation that's being processed
    if (isClearingRef.current) return
    
    if (cartItems.length >= 0) { // Only save if we have cart items or empty cart
      localStorage.setItem('cart', JSON.stringify(cartItems))
      
      // If logged in, sync to database (but debounce it)
      if (userId && isInitialized && !isSyncingRef.current) {
        const timeoutId = setTimeout(() => {
          saveToDatabase(cartItems)
        }, 500) // Debounce to prevent too many calls
        
        return () => clearTimeout(timeoutId)
      }
    }
  }, [cartItems, userId, isInitialized, saveToDatabase])

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const addToCart = useCallback(async (item: CartItem): Promise<boolean> => {
    // Check if user is logged in
    if (!isLoggedIn) {
      // Save intended item to localStorage for after login
      localStorage.setItem('pendingCartItem', JSON.stringify(item))
      router.push('/login')
      return false
    }

    setCartItems(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        return prev.map(i =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        )
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }]
    })
    
    // Clear pending item if exists
    localStorage.removeItem('pendingCartItem')
    return true
  }, [isLoggedIn, router])

  const removeFromCart = useCallback(async (id: number) => {
    setCartItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const updateQuantity = useCallback(async (id: number, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(id)
      return
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    )
  }, [removeFromCart])

  const clearCart = useCallback(async () => {
    // Set clearing flag to prevent recursive saves
    isClearingRef.current = true
    
    try {
      // Clear state
      setCartItems([])
      
      // Clear localStorage
      localStorage.removeItem('cart')
      
      // Clear from database if logged in
      if (userId) {
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', userId)
      }
    } catch (error) {
      console.error('Error clearing cart:', error)
    } finally {
      // Reset clearing flag after a short delay
      setTimeout(() => {
        isClearingRef.current = false
      }, 100)
    }
  }, [userId])

  const buyNow = useCallback(async (item?: CartItem) => {
    // Check if user is logged in
    if (!isLoggedIn) {
      // If there's a specific item, save it for after login
      if (item) {
        localStorage.setItem('pendingBuyNow', JSON.stringify(item))
      }
      router.push('/login')
      return
    }

    // If a single item is provided, add it to cart first
    if (item) {
      // Add to cart state
      setCartItems(prev => {
        const existing = prev.find(i => i.id === item.id)
        if (existing) {
          return prev.map(i =>
            i.id === item.id
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i
          )
        }
        return [...prev, { ...item, quantity: item.quantity || 1 }]
      })
      
      // Save to database
      if (userId) {
        // Check if item already exists in database
        const { data: existingItem } = await supabase
          .from('cart_items')
          .select('quantity')
          .eq('user_id', userId)
          .eq('product_id', item.id)
          .single()
        
        if (existingItem) {
          // Update existing item
          await supabase
            .from('cart_items')
            .update({ quantity: existingItem.quantity + (item.quantity || 1) })
            .eq('user_id', userId)
            .eq('product_id', item.id)
        } else {
          // Insert new item
          await supabase
            .from('cart_items')
            .insert({
              user_id: userId,
              product_id: item.id,
              quantity: item.quantity || 1
            })
        }
      }
      
      // Dispatch event to update navbar
      window.dispatchEvent(new Event('cartUpdated'))
      
      // Redirect to cart page
      router.push('/cart')
      return
    }

    // Otherwise buy all items in cart
    if (cartItems.length === 0) {
      alert('Your cart is empty!')
      return
    }
    
    // Redirect to cart page for checkout
    router.push('/cart')
  }, [isLoggedIn, router, userId, cartItems.length])

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        buyNow,
        syncCartWithDatabase,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}