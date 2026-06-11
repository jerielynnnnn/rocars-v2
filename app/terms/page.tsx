// app/terms/page.tsx
'use client'

import { FileText, ShoppingBag, CreditCard, Truck, Shield, RefreshCw, AlertCircle } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <section className="bg-gradient-to-r from-black to-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <FileText className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-4xl sm:text-5xl font-black mb-4">Terms of Service</h1>
          <p className="text-gray-300">Last updated: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              By using ROCARS Tire Trading's website and services, you agree to these Terms of Service. Please read them carefully.
            </p>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-yellow-500" />
              Products and Pricing
            </h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>All product descriptions, images, and prices are subject to change without notice</li>
              <li>We reserve the right to modify or discontinue any product at any time</li>
              <li>Prices are in Philippine Peso (PHP) and include applicable taxes</li>
              <li>We strive to display accurate product information but cannot guarantee that colors or details are perfectly represented</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-yellow-500" />
              Orders and Payments
            </h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>We reserve the right to refuse or cancel any order for any reason</li>
              <li>Payment must be received in full before order processing</li>
              <li>Accepted payment methods: Credit/Debit Cards, GCash, Bank Transfer, Cash on Delivery (select areas)</li>
              <li>Order confirmation emails are sent upon successful payment</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-yellow-500" />
              Shipping and Delivery
            </h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>Delivery times are estimates and not guaranteed</li>
              <li>Shipping costs are calculated at checkout</li>
              <li>Risk of loss transfers to you upon delivery</li>
              <li>We are not responsible for delays caused by weather, customs, or carrier issues</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-yellow-500" />
              Returns and Refunds
            </h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>7-day return policy for defective or incorrect items</li>
              <li>Products must be unused and in original packaging</li>
              <li>Return shipping costs are the customer's responsibility unless the item is defective</li>
              <li>Refunds are processed within 7-14 business days after return inspection</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-500" />
              Account Responsibilities
            </h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>You are responsible for maintaining your account credentials' confidentiality</li>
              <li>You are responsible for all activities under your account</li>
              <li>Notify us immediately of any unauthorized account access</li>
              <li>We reserve the right to terminate accounts for violations of these terms</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Limitation of Liability
            </h2>
            <p className="text-gray-600 mb-6">
              ROCARS Tire Trading shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our website or products. Our maximum liability is limited to the amount you paid for the product in question.
            </p>

            <h2 className="text-xl font-bold text-black mt-8 mb-4">Governing Law</h2>
            <p className="text-gray-600 mb-6">
              These terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any disputes shall be resolved exclusively in the courts of Cavite, Philippines.
            </p>

            <h2 className="text-xl font-bold text-black mt-8 mb-4">Changes to Terms</h2>
            <p className="text-gray-600 mb-6">
              We reserve the right to update these Terms of Service at any time. Changes become effective immediately upon posting. Continued use of our services constitutes acceptance of updated terms.
            </p>

            <h2 className="text-xl font-bold text-black mt-8 mb-4">Contact Us</h2>
            <p className="text-gray-600 mb-6">
              For questions about these Terms of Service:<br />
              Email: rocars.tire.trading@gmail.com<br />
              Phone: 0917-135-9278
            </p>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
              By using ROCARS Tire Trading, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}