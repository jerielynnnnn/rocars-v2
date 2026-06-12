export type CartItem = {
  id: number
  name: string
  price: number
  image: string
  quantity: number
}

const CART_KEY = 'cart'

// Get cart items
export const getCartItems = (): CartItem[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(CART_KEY)
  return data ? JSON.parse(data) : []
}

// Save cart items
export const saveCart = (items: CartItem[]) => {
  localStorage.setItem(CART_KEY, JSON.stringify(items))

  // Important: notify navbar instantly
  window.dispatchEvent(new Event('cartUpdated'))
}

// Add to cart
export const addToCart = (item: CartItem) => {
  const cart = getCartItems()

  const existing = cart.find((p) => p.id === item.id)

  if (existing) {
    existing.quantity += item.quantity
  } else {
    cart.push(item)
  }

  saveCart(cart)
}

// Remove item
export const removeFromCart = (id: number) => {
  const updated = getCartItems().filter((item) => item.id !== id)
  saveCart(updated)
}

// Update quantity
export const updateQuantity = (id: number, qty: number) => {
  const cart = getCartItems().map((item) =>
    item.id === id ? { ...item, quantity: qty } : item
  )

  saveCart(cart)
}

// Cart count (navbar badge)
export const getCartCount = () => {
  const cart = getCartItems()
  return cart.reduce((sum, item) => sum + item.quantity, 0)
}

// Total price
export const getCartTotal = () => {
  const cart = getCartItems()
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
