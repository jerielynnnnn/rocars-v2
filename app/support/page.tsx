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
  Headphones,
  LogIn,
  UserPlus,
  Key,
  Bell,
  Heart,
  Star,
  CheckCircle,
  Zap,
  Lock,
  Accessibility,
  Mic,
  Type,
  Volume2,
  Ticket,
} from 'lucide-react'

export default function SupportPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Contact Methods with real details
  const contactMethods = [
    {
      icon: Phone,
      title: 'Hotline',
      details: '0917-135-9278',
      description: 'Mon-Sat, 9AM - 6PM',
      action: 'tel:+639171359278',
    },
    
    {
      icon: MessageCircle,
      title: 'Viber',
      details: 'ROCARS Support',
      description: 'Chat via Viber',
      action: 'https://tinyurl.com/t7p63w7m',
    },
    {
      icon: Mail,
      title: 'Email Support',
      details: 'support@rocars.com',
      description: 'Response within 24 hours',
      action: 'mailto:support@rocars.com',
    },
  ]

  // Branch locations with real details
  const branches = [
    {
      location: 'Salawag, Cavite',
      phone: '0917-135-9278',
      address: 'Salawag, Cavite',
    },
    {
      location: 'Salitran, Cavite',
      phone: '0917-104-6171',
      address: 'Salitran, Cavite',
    },
    {
      location: 'Lipa, Batangas',
      phone: '0917-102-7174',
      address: 'Lipa, Batangas',
    },
  ]

  const voiceCommands = [
    { command: 'go to home', description: 'Open the home page.' },
    { command: 'go to products', description: 'Open the products page.' },
    { command: 'go to cart', description: 'Open your cart.' },
    { command: 'go to profile', description: 'Open your profile.' },
    { command: 'go to orders', description: 'Open your orders.' },
    { command: 'go to dashboard', description: 'Open the admin dashboard.' },
    { command: 'go to admin products', description: 'Open admin product management.' },
    { command: 'go to admin orders', description: 'Open admin order management.' },
    { command: 'search brake pads', description: 'Search the current page for brake pads. You can replace brake pads with any product term.' },
    { command: 'search for tires', description: 'Search the current page for tires. You can replace tires with any product term.' },
    { command: 'add to cart', description: 'Click the first available add-to-cart button on the page.' },
    { command: 'checkout', description: 'Go to checkout.' },
    { command: 'scroll down', description: 'Move the page down.' },
    { command: 'scroll up', description: 'Move the page up.' },
    { command: 'go to top', description: 'Return to the top of the page.' },
    { command: 'read page', description: 'Read the main page content aloud.' },
    { command: 'stop reading', description: 'Stop text-to-speech playback.' },
    { command: 'open accessibility', description: 'Open the accessibility panel.' },
    { command: 'close accessibility', description: 'Close the accessibility panel.' },
    { command: 'back', description: 'Go back to the previous page.' },
    { command: 'next page', description: 'Click the next page button when available.' },
    { command: 'previous page', description: 'Click the previous page button when available.' },
  ]

  const gettingStartedFaqs = [
    {
      question: 'How do I create an account?',
      answer: 'Click the "Register" button in the top right corner. Fill in your email, username, first name, last name, and create a password. You\'ll receive a verification email to activate your account.',
      icon: UserPlus,
    },
    {
      question: 'How do I sign in?',
      answer: 'Click "Login" and enter your email/username and password. You can also sign in using Google OAuth. Make sure to verify your email first before logging in.',
      icon: LogIn,
    },
    {
      question: 'I forgot my password, what should I do?',
      answer: 'Click "Forgot password?" on the login page. Enter your email address and we\'ll send you a reset link. Follow the link to create a new password.',
      icon: Key,
    },
    {
      question: 'Why is my account locked?',
      answer: 'Accounts are temporarily locked after multiple failed login attempts. Wait 15 minutes or contact support to unlock your account.',
      icon: Lock,
    },
  ]

  const featuresFaqs = [
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept Credit/Debit Cards (Visa, Mastercard), GCash, PayPal, and Bank Transfers. All payments are 256-bit SSL encrypted for security.',
      icon: CreditCard,
    },
    {
      question: 'How do I track my orders?',
      answer: 'Go to "My Orders" in your account dashboard. Each order has a tracking number and real-time status updates (Pending, Processing, Shipped, Delivered). You\'ll also receive email notifications at each stage.',
      icon: Package,
    },
    {
      question: 'How do I use wishlists?',
      answer: 'Click the heart icon ♥ on any product to add it to your wishlist. Access your wishlist from your account dashboard to easily reorder or monitor price drops.',
      icon: Heart,
    },
    {
      question: 'Can I leave reviews for products?',
      answer: 'Yes! After receiving your order, go to "My Orders" and click "Write Review" on the purchased product. Rate 1-5 stars and add comments to help other buyers.',
      icon: Star,
    },
  ]

  const shoppingFaqs = [
    {
      question: 'How do I use vouchers and discounts?',
      answer: 'At checkout, enter your voucher code in the "Voucher Code" field. Discounts apply automatically. Check your profile for available vouchers and ongoing promotions.',
      icon: Ticket,
    },
    {
      question: 'How long does shipping take?',
      answer: 'Metro Manila: 1-3 business days. Provincial: 3-7 business days. Remote areas: 7-10 business days. Free shipping on orders over ₱2,500!',
      icon: Truck,
    },
    {
      question: 'What is your return policy?',
      answer: '7-day return policy for defective/incorrect items. Products must be unused with original packaging. Initiate returns from "My Orders" or contact support.',
      icon: Shield,
    },
    {
      question: 'What is your warranty policy?',
      answer: 'We offer a 30-day warranty on all electronic parts and a 7-day warranty on replacement parts. Warranty covers manufacturing defects only.',
      icon: Shield,
    },
  ]

  const accountFaqs = [
    {
      question: 'How do I update my profile information?',
      answer: 'Go to "My Profile" in your account dashboard. You can update your name, contact number, address book, and notification preferences.',
      icon: User,
    },
    {
      question: 'How do I enable email notifications?',
      answer: 'In "Profile Settings", toggle email notifications for order updates, promotions, and product alerts. You can customize which emails you receive.',
      icon: Bell,
    },
    {
      question: 'Can I save multiple shipping addresses?',
      answer: 'Yes! Add multiple addresses in your address book. Select your preferred default address and choose different addresses for different orders.',
      icon: MapPin,
    },
    {
      question: 'How do I change my password?',
      answer: 'Go to "Profile Settings" → "Security" → "Change Password". Enter your current password and new password. Use a strong password with 8+ characters including letters and numbers.',
      icon: Key,
    },
  ]

  const accessibilityFaqs = [
    {
      question: 'How do I open the accessibility tools?',
      answer: 'Hover over or focus the accessibility icon near the lower-right side of the page. You can also click it to keep the panel open, or press Ctrl + Shift + A.',
      icon: Accessibility,
    },
    {
      question: 'What accessibility tools are available?',
      answer: 'You can change text size, switch visual contrast modes, reduce motion, increase reading spacing, read the page aloud, reset all accessibility settings, and start voice commands when your browser supports speech recognition.',
      icon: Type,
    },
    {
      question: 'How do I use voice commands?',
      answer: 'Open the accessibility panel, choose Voice commands, allow microphone access if your browser asks, then speak one of the supported commands such as "go to products", "search tires", "scroll down", or "read page".',
      icon: Mic,
    },
    {
      question: 'Why are voice commands not available?',
      answer: 'Voice commands require browser speech recognition support and microphone permission. If the button says Unsupported, try Chrome or Edge on desktop and make sure microphone access is allowed.',
      icon: Volume2,
    },
  ]

  const allFaqs = [
    ...gettingStartedFaqs,
    ...featuresFaqs,
    ...shoppingFaqs,
    ...accountFaqs,
    ...accessibilityFaqs,
  ]

  const categories = [
    { id: 'all', name: 'All Questions', icon: HelpCircle },
    { id: 'getting-started', name: 'Getting Started', icon: UserPlus },
    { id: 'features', name: 'Features', icon: Zap },
    { id: 'shopping', name: 'Shopping', icon: ShoppingBag },
    { id: 'account', name: 'Account', icon: User },
    { id: 'accessibility', name: 'Accessibility', icon: Accessibility },
  ]

  const getFilteredFaqs = () => {
    let filtered = allFaqs
    
    if (selectedCategory !== 'all') {
      switch(selectedCategory) {
        case 'getting-started':
          filtered = gettingStartedFaqs
          break
        case 'features':
          filtered = featuresFaqs
          break
        case 'shopping':
          filtered = shoppingFaqs
          break
        case 'account':
          filtered = accountFaqs
          break
        case 'accessibility':
          filtered = accessibilityFaqs
          break
      }
    }
    
    if (searchQuery) {
      filtered = filtered.filter(faq =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    return filtered
  }

  const filteredFaqs = getFilteredFaqs()

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-black to-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-1.5 mb-6">
              <Headphones className="w-4 h-4" />
              <span className="text-sm">Customer Support</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-4">
              How can we help you?
            </h1>
            <p className="text-gray-300 text-lg mb-8">
              Get instant answers, track orders, or connect with our support team
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
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

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {contactMethods.map((method, index) => {
            const Icon = method.icon
            return (
              <a
                key={index}
                href={method.action}
                target={method.action.startsWith('http') ? '_blank' : undefined}
                rel={method.action.startsWith('http') ? 'noopener noreferrer' : undefined}
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

      {/* Branch Locations */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-black">
            Our Branches
          </h2>
          <p className="text-gray-500 mt-2">
            Visit us at any of our locations
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {branches.map((branch, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-gray-900">{branch.location}</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{branch.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{branch.address}</span>
                </div>
                <button
                  onClick={() => window.location.href = `tel:${branch.phone.replace(/-/g, '')}`}
                  className="mt-3 w-full py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  Call Branch
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Accessibility Guide */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-black">
            Accessibility Guide
          </h2>
          <p className="text-gray-500 mt-2">
            Learn how to use reading tools, visual modes, and voice navigation
          </p>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-black text-yellow-400 flex items-center justify-center">
                <Accessibility className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">How to Use Accessibility</h3>
                <p className="text-sm text-gray-500">Open, adjust, and reset your browsing tools</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                ['Open the panel', 'Hover or focus the accessibility icon near the lower-right side of the page. Click it if you want the panel to stay open.'],
                ['Use the shortcut', 'Press Ctrl + Shift + A to open or close the accessibility panel.'],
                ['Adjust reading', 'Choose text size, reading spacing, reduce motion, or a visual contrast mode. Changes are saved in this browser.'],
                ['Read aloud', 'Choose Read this page aloud to hear the page content. Use Stop reading by voice command to stop playback.'],
                ['Reset settings', 'Choose Reset all accessibility settings to return text size, contrast, motion, spacing, and voice tools to default.'],
              ].map(([title, description]) => (
                <div key={title} className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">{title}</p>
                    <p className="text-sm text-gray-600">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Mic className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Recognized Voice Commands</h3>
                  <p className="text-sm text-gray-500">Enable Voice commands in the accessibility panel, then say one of these phrases</p>
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {voiceCommands.map((item) => (
                <div key={item.command} className="px-6 py-4 hover:bg-gray-50 transition">
                  <p className="font-mono text-sm font-semibold text-black">&quot;{item.command}&quot;</p>
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section with Categories */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-black">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-500 mt-2">
            Find quick answers to common questions about ROCARS
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedCategory === category.id
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.name}
              </button>
            )
          })}
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No results found for &quot;{searchQuery}&quot;</p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                }}
                className="mt-2 text-sm text-black hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredFaqs.map((faq, index) => {
                const Icon = faq.icon
                return (
                  <div key={index} className="p-6 hover:bg-gray-50 transition">
                    <button
                      onClick={() => toggleFaq(index)}
                      className="flex items-start justify-between w-full text-left gap-4"
                    >
                      <div className="flex gap-3">
                        <div className="w-6 h-6 text-gray-400 shrink-0 mt-0.5">
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-gray-900">
                          {faq.question}
                        </h3>
                      </div>
                      {openFaq === index ? (
                        <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                    </button>
                    {openFaq === index && (
                      <div className="mt-3 ml-9 text-gray-600 text-sm leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Business Hours & Location */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
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
                  <p className="text-xs text-gray-400 mt-2">Customer support available via Messenger and Viber</p>
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
                <h3 className="font-bold text-lg mb-2">Main Office</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>ROCARS Tire Trading</p>
                  <p>Salawag, Cavite</p>
                  <p>Philippines</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Still Need Help */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-gradient-to-r from-gray-900 to-black rounded-3xl p-8 text-center text-white">
          <Headphones className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Still need assistance?</h3>
          <p className="text-gray-300 mb-6">
            Our support team is ready to help you with any questions
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.href = 'mailto:support@rocars.com'}
              className="px-6 py-2.5 rounded-2xl bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-500 transition"
            >
              Email Support
            </button>
            <button
              onClick={() => window.location.href = 'tel:+639171359278'}
              className="px-6 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition"
            >
              Call Hotline
            </button>
            <button
              onClick={() => window.open('https://m.me/125137444018608', '_blank')}
              className="px-6 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition"
            >
              Message on Messenger
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

