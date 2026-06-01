'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Phone,
  Mail,
  MessageCircle,
  Search,
  Clock,
  MapPin,
  User,
  ShoppingBag,
  CreditCard,
  Truck,
  Package,
  Shield,
  HelpCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Headphones,
} from 'lucide-react'

export default function SupportPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const contactMethods = [
    {
      icon: Phone,
      title: 'Hotline',
      details: '(02) 1234 5678',
      description: 'Mon-Sat, 9AM - 6PM',
      action: 'tel:+63212345678',
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      details: 'Chat with support',
      description: 'Available 24/7',
      action: '#',
    },
    {
      icon: Mail,
      title: 'Email Support',
      details: 'support@rocars.com',
      description: 'Response within 24 hours',
      action: 'mailto:support@rocars.com',
    },
  ]

  const faqs = [
    {
      question: 'How do I track my order?',
      answer: 'You can track your order by logging into your account and visiting the "My Orders" section. Click on the specific order to see real-time tracking updates. You will also receive email notifications with tracking links once your order ships.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept Credit/Debit Cards (Visa, Mastercard), GCash, PayPal, and Bank Transfers. All payments are processed securely through our payment partners.',
    },
    {
      question: 'How long does shipping take?',
      answer: 'Metro Manila: 1-3 business days. Provincial: 3-7 business days. Remote areas may take 7-10 business days. You will receive a tracking number once your order ships.',
    },
    {
      question: 'What is your return policy?',
      answer: 'We offer a 7-day return policy for defective or incorrect items. Products must be unused and in original packaging. Contact our support team to initiate a return request.',
    },
    {
      question: 'How do I know if a part fits my car?',
      answer: 'Use our vehicle fitment tool on product pages. Enter your car make, model, and year to check compatibility. You can also contact our support team for assistance.',
    },
    {
      question: 'Can I cancel my order?',
      answer: 'Orders can be cancelled within 2 hours of placement, provided they haven\'t been processed for shipping. Contact support immediately if you need to cancel.',
    },
    {
      question: 'How do I use a voucher code?',
      answer: 'Enter your voucher code at checkout in the "Voucher Code" field. The discount will be applied automatically if valid. Vouchers cannot be combined with other offers.',
    },
    {
      question: 'What should I do if I receive a damaged item?',
      answer: 'Take photos of the damaged item and packaging, then contact our support team within 24 hours of delivery. We will arrange for a replacement or refund.',
    },
  ]

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Hero Section */}
      <section className="bg-black text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-black mb-4">
              How can we help you?
            </h1>
            <p className="text-gray-300 text-lg">
              Find answers, track orders, or get in touch with our support team
            </p>
            
            {/* Search Bar */}
            <div className="relative mt-8 max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search for help articles, FAQs, or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:bg-black transition"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Help Categories */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Package, label: 'Track Order', href: '/orders' },
            { icon: ShoppingBag, label: 'My Orders', href: '/orders' },
            { icon: Truck, label: 'Shipping Info', href: '/shipping' },
            { icon: CreditCard, label: 'Payments', href: '/profile' },
          ].map((item, index) => (
            <button
              key={index}
              onClick={() => router.push(item.href)}
              className="bg-white rounded-2xl p-4 text-center border border-gray-200 hover:shadow-lg transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3 group-hover:bg-black group-hover:text-white transition">
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Contact Methods */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-black">
            Contact Our Support Team
          </h2>
          <p className="text-gray-500 mt-2">
            Choose the best way to reach us
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {contactMethods.map((method, index) => {
            const Icon = method.icon
            return (
              <a
                key={index}
                href={method.action}
                className="bg-white rounded-3xl p-6 border border-gray-200 hover:shadow-lg transition group text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center mx-auto mb-4 group-hover:bg-yellow-400 group-hover:text-black transition">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg mb-2">{method.title}</h3>
                <p className="text-sm font-medium text-black">{method.details}</p>
                <p className="text-xs text-gray-500 mt-1">{method.description}</p>
              </a>
            )
          })}
        </div>
      </section>

      {/* Business Hours & Location */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Business Hours</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Monday - Friday: 9:00 AM - 8:00 PM</p>
                  <p>Saturday: 10:00 AM - 6:00 PM</p>
                  <p>Sunday: Closed</p>
                  <p className="text-xs text-gray-400 mt-2">Customer support available 24/7 via live chat</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Office Location</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>ROCARS Auto Parts Trading</p>
                  <p>123 Automation Street,</p>
                  <p>Quezon City, Metro Manila</p>
                  <p>Philippines 1100</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-black">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-500 mt-2">
            Find quick answers to common questions
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No results found for "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm text-black hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredFaqs.map((faq, index) => (
                <div key={index} className="p-6">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h3 className="font-semibold text-gray-900 pr-4">
                      {faq.question}
                    </h3>
                    {openFaq === index ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {openFaq === index && (
                    <div className="mt-3 text-gray-600 text-sm leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Order Tracking Guide */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-gradient-to-r from-black to-gray-900 rounded-3xl p-8 text-white">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Need to track your order?</h2>
            <p className="text-gray-300 mt-2">
              Enter your order number to get real-time updates
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Order #ROC-XXXXX"
                className="flex-1 h-11 px-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              />
              <button
                onClick={() => router.push('/orders')}
                className="px-6 h-11 rounded-2xl bg-yellow-400 text-black font-medium hover:bg-yellow-500 transition"
              >
                Track
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">
              Don't have an account?{' '}
              <button
                onClick={() => router.push('/register')}
                className="text-yellow-400 hover:underline"
              >
                Sign up
              </button>
              {' '}to view all your orders
            </p>
          </div>
        </div>
      </section>

      {/* Still Need Help */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center">
          <Headphones className="w-12 h-12 text-black mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Still need assistance?</h3>
          <p className="text-gray-500 mb-6">
            Our support team is ready to help you with any questions
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.href = 'mailto:support@rocars.com'}
              className="px-6 py-2.5 rounded-2xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition"
            >
              Email Support
            </button>
            <button
              onClick={() => window.location.href = 'tel:+63212345678'}
              className="px-6 py-2.5 rounded-2xl border border-gray-300 text-black text-sm font-medium hover:bg-gray-50 transition"
            >
              Call Hotline
            </button>
          </div>
        </div>
      </section>

      {/* Back to Home */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>
    </div>
  )
}