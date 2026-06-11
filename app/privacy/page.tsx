// app/privacy/page.tsx
'use client'

import { Shield, Lock, Eye, Database, Mail, FileText } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <section className="bg-gradient-to-r from-black to-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <Shield className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-4xl sm:text-5xl font-black mb-4">Privacy Policy</h1>
          <p className="text-gray-300">Last updated: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              At ROCARS Tire Trading, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
            </p>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-yellow-500" />
              Information We Collect
            </h2>
            <p className="text-gray-600 mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>Personal identification information (name, email address, phone number, shipping address)</li>
              <li>Account credentials (username and encrypted password)</li>
              <li>Payment information (processed securely through third-party payment gateways)</li>
              <li>Order history and product preferences</li>
              <li>Communications with our support team</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-yellow-500" />
              How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>Process and fulfill your orders</li>
              <li>Communicate with you about orders, products, and promotions</li>
              <li>Improve our website, products, and customer service</li>
              <li>Protect against fraudulent or unauthorized transactions</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-yellow-500" />
              Information Sharing
            </h2>
            <p className="text-gray-600 mb-4">We do not sell, trade, or rent your personal information to third parties. We may share information with:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>Service providers who assist with order fulfillment, payment processing, and delivery</li>
              <li>Law enforcement when required by law or to protect our rights</li>
              <li>Third parties with your consent</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-yellow-500" />
              Email Communications
            </h2>
            <p className="text-gray-600 mb-6">
              We may send you emails about your orders, account activities, and promotional offers. You can opt-out of marketing emails at any time by clicking the unsubscribe link or contacting us.
            </p>

            <h2 className="text-xl font-bold text-black mt-8 mb-4">Data Security</h2>
            <p className="text-gray-600 mb-6">
              We implement industry-standard security measures to protect your personal information. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>

            <h2 className="text-xl font-bold text-black mt-8 mb-4">Your Rights</h2>
            <p className="text-gray-600 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal data</li>
              <li>Opt-out of marketing communications</li>
            </ul>

            <h2 className="text-xl font-bold text-black mt-8 mb-4">Contact Us</h2>
            <p className="text-gray-600 mb-6">
              If you have questions about this Privacy Policy, please contact us at:<br />
              Email: rocars.tire.trading@gmail.com<br />
              Phone: 0917-135-9278<br />
              Address: Salawag, Dasmariñas, Cavite, Philippines 4114
            </p>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
              <FileText className="w-4 h-4 inline mr-2" />
              This Privacy Policy may be updated periodically. Please review this page for any changes.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}