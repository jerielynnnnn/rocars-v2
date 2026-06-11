export type StaffRole =
  | 'admin'
  | 'staff'
  | 'staff_orders'
  | 'staff_shipping'
  | 'staff_payments'
  | 'staff_orders_shipping'
  | 'staff_orders_payments'
  | 'staff_shipping_payments'

export function isAdminLikeRole(role?: string | null): boolean {
  if (!role) return false

  return role === 'admin' || role === 'staff' || role.startsWith('staff_')
}

export function isStaffRole(role?: string | null): boolean {
  if (!role) return false

  return role === 'staff' || role.startsWith('staff_')
}

export function getRoleLabel(role?: string | null): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'staff':
      return 'Staff Manager'
    case 'staff_orders':
      return 'Orders Staff'
    case 'staff_shipping':
      return 'Shipping Staff'
    case 'staff_payments':
      return 'Payments Staff'
    case 'staff_orders_shipping':
      return 'Orders + Shipping Staff'
    case 'staff_orders_payments':
      return 'Orders + Payments Staff'
    case 'staff_shipping_payments':
      return 'Shipping + Payments Staff'
    default:
      return 'Staff'
  }
}

export function getRoleModules(role?: string | null): string[] {
  if (role === 'admin') {
    return ['Dashboard', 'Users', 'Products', 'Orders', 'Payments', 'Refunds', 'Reviews', 'Categories', 'Vouchers', 'Notifications', 'Shipping', 'Settings']
  }

  if (role === 'staff') {
    return ['Products', 'Orders', 'Payments', 'Refunds', 'Shipping', 'Settings']
  }

  const modules = new Set<string>(['Products'])

  if (role?.includes('orders')) modules.add('Orders')
  if (role?.includes('shipping')) modules.add('Shipping')
  if (role?.includes('payments')) {
    modules.add('Payments')
    modules.add('Refunds')
  }

  return Array.from(modules)
}

export const STAFF_ALLOWED_ADMIN_PATHS = [
  '/admin/products',
  '/admin/orders',
  '/admin/payments',
  '/admin/refunds',
  '/admin/shipping',
  '/admin/settings',
]

export const STAFF_DEFAULT_ADMIN_PATH = '/admin/products'

export function canAccessAdminPath(role: string | null | undefined, pathname: string): boolean {
  if (role === 'admin') return true
  if (!isStaffRole(role)) return false

  return STAFF_ALLOWED_ADMIN_PATHS.some((allowedPath) =>
    pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
  )
}
