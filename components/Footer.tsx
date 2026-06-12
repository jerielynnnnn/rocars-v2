// components/Footer.tsx
'use client'

import Link from 'next/link'
import { Car, MapPin, Phone, Mail, } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-black text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* BRAND SECTION */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Car className="h-6 w-6 text-yellow-400" />
              <span className="font-bold text-xl">ROCARS</span>
            </div>
            <p className="text-gray-400 text-sm">
              Premium automotive parts marketplace built for speed, quality, and performance.
              Your trusted partner for quality auto parts in the Philippines since 2020.
            </p>
            <div className="flex gap-4 mt-4">
              {/* Facebook */}
              <a 
                href="https://facebook.com/rocars" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-yellow-400 transition"
                aria-label="Facebook"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>

          {/* NAVIGATION LINKS */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-gray-400 hover:text-yellow-400 transition">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-gray-400 hover:text-yellow-400 transition">
                  Products
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-gray-400 hover:text-yellow-400 transition">
                  Cart
                </Link>
              </li>
              <li>
                <Link href="/orders" className="text-gray-400 hover:text-yellow-400 transition">
                  Orders
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-gray-400 hover:text-yellow-400 transition">
                  Support
                </Link>
              </li>
            </ul>
          </div>

          {/* QUICK LINKS */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-yellow-400 transition">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-yellow-400 transition">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-gray-400 hover:text-yellow-400 transition">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-gray-400 hover:text-yellow-400 transition">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-yellow-400 transition">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-yellow-400 transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-yellow-400 transition">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* CONTACT INFO - Updated with actual ROCARS details */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Contact Info</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-gray-400">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Salawag, Dasmariñas, Cavite, Philippines 4114</span>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <Phone className="w-4 h-4 shrink-0" />
                <a href="tel:+639171359278" className="hover:text-yellow-400 transition">
                  0917-135-9278
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <Phone className="w-4 h-4 shrink-0" />
                <a href="tel:+639171046171" className="hover:text-yellow-400 transition">
                  0917-104-6171
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <Phone className="w-4 h-4 shrink-0" />
                <a href="tel:+639171027174" className="hover:text-yellow-400 transition">
                  0917-102-7174
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <Mail className="w-4 h-4 shrink-0" />
                <a href="mailto:rocars.tire.trading@gmail.com" className="hover:text-yellow-400 transition">
                  rocars.tire.trading@gmail.com
                </a>
              </li>
            </ul>
            
            {/* Business Hours */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <h5 className="text-sm font-semibold text-white mb-2">Business Hours</h5>
              <p className="text-xs text-gray-400">Monday - Saturday: 9:00 AM - 6:00 PM</p>
              <p className="text-xs text-gray-400">Sunday: Closed</p>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
          <p>&copy; {currentYear} ROCARS Tire Trading. All rights reserved.</p>
          <p className="text-xs mt-1">Your trusted auto parts supplier in Cavite and Batangas</p>
        </div>
      </div>
    </footer>
  )
}
