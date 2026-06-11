import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CartProvider } from '@/context/CartContext'
import { AddressProvider } from '@/context/AddressContext'
import { PaymentProvider } from '@/context/PaymentContext'
import Navbar from '@/components/Navbar'
import AccessibilityWidget from '@/components/AccessibilityWidget'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AutoParts Store',
  description: 'Premium auto parts store',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.className}>
        <CartProvider>
          <AddressProvider>
            <PaymentProvider>
              <Navbar />
              {children}
              <AccessibilityWidget />
            </PaymentProvider>
          </AddressProvider>
        </CartProvider>
      </body>
    </html>
  )
}
