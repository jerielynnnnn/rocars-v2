// app/shipping/page.tsx
'use client'

import Link from 'next/link'
import {
  Truck,
  Clock3,
  ShieldCheck,
  MapPin,
  Package,
  CreditCard,
  AlertCircle,
  Phone,
  Mail,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  Radio,
  Building2,
} from 'lucide-react'

export default function ShippingInformationPage() {
  const shippingSteps = [
    {
      title: 'Order Confirmation',
      description:
        'Once your order is placed, you will receive an order confirmation through email and your ROCARS account.',
    },
    {
      title: 'Processing',
      description:
        'Orders are reviewed and prepared within 1–2 business days depending on item availability.',
    },
    {
      title: 'Shipping & Dispatch',
      description:
        'Your order will be handed to our delivery partner and tracking details will be updated in your account.',
    },
    {
      title: 'Delivered',
      description:
        'Receive your automotive parts safely at your selected delivery address.',
    },
  ]

  const deliveryAreas = [
    'Metro Manila',
    'Cavite Province',
    'Batangas Province',
    'Laguna Province',
    'Bulacan',
    'Pampanga',
    'Rizal',
    'Other Luzon Provinces',
  ]

  const reminders = [
    'Please double-check your shipping address before placing an order.',
    'Delivery times may vary during holidays or severe weather conditions.',
    'Large automotive parts (tires, mags, 4x4 equipment) may require additional handling time.',
    'Customers will receive updates through email and SMS notifications.',
    'For bulk orders or special shipping arrangements, please contact our support team.',
  ]

  return (
    <div className="min-h-screen bg-white text-black">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-black bg-black text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-gray-500 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur-sm">
              <Truck className="h-4 w-4" />
              ROCARS Shipping Information
            </div>

            <h1 className="text-4xl font-black leading-tight md:text-6xl">
              Fast & Reliable
              <span className="block text-gray-300">
                Nationwide Delivery
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-300">
              ROCARS ensures that your automotive parts are packed securely and
              delivered efficiently across the Philippines. Track your orders,
              review shipping timelines, and stay informed every step of the
              way.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-105"
              >
                Continue Shopping
                <ChevronRight className="h-4 w-4" />
              </Link>

              <Link
                href="/orders"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                View Orders
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
              <Truck className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-black">Nationwide Shipping</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              We deliver automotive parts across major cities and provinces in the Philippines.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-black">
              <Clock3 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-black">Quick Processing</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Orders are usually processed within 1–2 business days after payment confirmation.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-black">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-black">Secure Packaging</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Your products are packed carefully to help prevent damages during transit.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-black">
              <Package className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-black">Order Tracking</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Stay updated with real-time delivery and shipping status notifications.
            </p>
          </div>
        </div>
      </section>

      {/* SHIPPING PROCESS */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-sm md:p-12">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              <Truck className="h-4 w-4" />
              Shipping Workflow
            </div>
            <h2 className="text-3xl font-black text-black md:text-4xl">
              How Shipping Works at ROCARS
            </h2>
            <p className="mt-4 text-gray-600">
              From order confirmation to final delivery, ROCARS keeps the shipping process simple, transparent, and reliable.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {shippingSteps.map((step, index) => (
              <div
                key={index}
                className="rounded-3xl border border-gray-200 bg-gray-50 p-6 transition hover:bg-white hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-lg font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-black">{step.title}</h3>
                    <p className="mt-2 leading-relaxed text-gray-600">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DELIVERY + REMINDERS */}
      <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-16 lg:grid-cols-2 lg:px-8">
        <div className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
              <MapPin className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black">Delivery Areas</h2>
              <p className="text-sm text-gray-500">Areas currently supported by ROCARS shipping</p>
            </div>
          </div>
          <div className="space-y-3">
            {deliveryAreas.map((area, index) => (
              <div key={index} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-black" />
                <span className="font-medium text-gray-700">{area}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black">Important Reminders</h2>
              <p className="text-sm text-gray-500">Please read before placing an order</p>
            </div>
          </div>
          <div className="space-y-3">
            {reminders.map((reminder, index) => (
              <div key={index} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="leading-relaxed text-gray-700">{reminder}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT & SUPPORT */}
      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Payment Section */}
          <div className="rounded-[32px] bg-black p-8 text-white shadow-xl">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
              <CreditCard className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-black">Payment Verification</h2>
            <p className="mt-4 leading-relaxed text-gray-300">
              Orders paid through online payment methods may require verification before shipping.
              Once payment is confirmed, the shipping process begins immediately.
            </p>
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">Estimated Processing Time</p>
                <p className="mt-1 text-sm text-gray-300">1–2 Business Days</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">Estimated Delivery Time</p>
                <p className="mt-1 text-sm text-gray-300">3–7 Business Days Depending on Location</p>
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
              <Phone className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-black text-black">Need Shipping Assistance?</h2>
            <p className="mt-4 leading-relaxed text-gray-600">
              Our support team is ready to help you with shipping concerns, order tracking,
              delivery updates, and address changes.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Phone className="h-5 w-5 text-black" />
                <div>
                  <p className="text-sm text-gray-500">Customer Hotline</p>
                  <p className="font-semibold text-black">0917 135 9278</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <MessageCircle className="h-5 w-5 text-black" />
                <div>
                  <p className="text-sm text-gray-500">Messenger</p>
                  <a href="https://m.me/125137444018608" target="_blank" rel="noopener noreferrer" className="font-semibold text-black hover:text-amber-600">
                    m.me/ROCARS
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Radio className="h-5 w-5 text-black" />
                <div>
                  <p className="text-sm text-gray-500">Viber</p>
                  <a href="https://tinyurl.com/t7p63w7m" target="_blank" rel="noopener noreferrer" className="font-semibold text-black hover:text-amber-600">
                    tinyurl.com/ROCARSviber
                  </a>
                </div>
              </div>
            </div>

            <Link
              href="/contact"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
            >
              Contact Support
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}