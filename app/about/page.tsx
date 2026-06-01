'use client'

import Link from 'next/link'
import {
  Wrench,
  ShoppingBag,
  CheckCircle2,
  Sparkles,
  Phone,
  MapPinned,
  Battery,
  Compass,
  Settings,
  AlignJustify,
  Shield,
  Star,
  Truck,
  MessageCircle,
  Radio,
  Clock,
  Award,
  Users,
  ThumbsUp,
  Mail,
  Globe,
  Zap,
  TrendingUp,
  Map,
  Heart,
  Calendar,
  BadgeCheck,
  Headphones,
} from 'lucide-react'

export default function AboutPage() {
  const locations = [
    { name: 'SALAWAG, CAVITE', phone: '09171359278', address: 'Salawag, Cavite' },
    { name: 'SALITRAN, CAVITE', phone: '09171046171', address: 'Salitran, Cavite' },
    { name: 'LIPA, BATANGAS', phone: '09171027174', address: 'Lipa, Batangas' },
  ]

  const tireBrands = [
    'BRIDGESTONE', 'MICHELIN', 'BFGoodrich', 'GOODYEAR', 'DUNLOP',
    'FALKEN', 'YOKOHAMA', 'MAXXIS', 'TOYO TIRES', 'T-MAX',
    'MAXIMUM OFFROAD RECOVERY', 'EXPLORAR TIRES'
  ]

  const accessoriesBrands = [
    'ARB', 'OLD MAN EMU', '4X4 EQUIPPED', '4X4 ACCESSORIES',
    'MAGS', 'UNDERCHASSIS', 'OFFROAD RECOVERY'
  ]

  const services = [
    { icon: Wrench, name: 'PMS PACKAGE', desc: 'Preventive maintenance service for your vehicle' },
    { icon: Settings, name: 'UNDERCHASIS', desc: 'Suspension & underbody repair specialists' },
    { icon: Compass, name: '4X4 OFFROAD', desc: 'Offroad setup, recovery & accessories' },
    { icon: Battery, name: 'BATTERY', desc: 'Battery replacement, testing & diagnostics' },
    { icon: AlignJustify, name: 'ALIGNMENT', desc: 'Wheel alignment & balancing services' },
    { icon: ShoppingBag, name: 'ACCESSORIES', desc: 'Mags, tires & 4x4 accessories' },
  ]

  const stats = [
    { number: '22K+', label: 'Followers', icon: Users, color: 'text-blue-500' },
    { number: '10+', label: 'Years Experience', icon: Award, color: 'text-purple-500' },
    { number: '50+', label: 'Tire Brands', icon: Star, color: 'text-yellow-500' },
    { number: '3', label: 'Locations', icon: MapPinned, color: 'text-green-500' },
  ]

  const ecommerceBenefits = [
    { icon: Globe, title: 'Nationwide Reach', description: 'Order premium auto parts from anywhere in the Philippines, delivered right to your doorstep.' },
    { icon: Zap, title: '24/7 Accessibility', description: 'Shop anytime, anywhere. No need to travel to our physical locations.' },
    { icon: Truck, title: 'Fast & Reliable Shipping', description: 'Get your parts delivered quickly with our trusted logistics partners.' },
    { icon: TrendingUp, title: 'Expanded Inventory', description: 'Access thousands of products online that may not be available in-store.' },
    { icon: Map, title: 'Service Beyond Borders', description: 'Serving customers across Luzon, Visayas, and Mindanao with quality auto parts.' },
    { icon: Heart, title: 'Customer First', description: 'Dedicated support team ready to assist with orders, inquiries, and installations.' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
    
      {/* ECOMMERCE EXPANSION SECTION */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yellow-100 border border-yellow-200 mb-6">
            <Globe className="h-4 w-4 text-yellow-600" />
            <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Digital Transformation</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-black mb-5">
            Expanding Horizons with <span className="text-yellow-500">ROCARS E-Commerce</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
            Bringing premium automotive parts closer to every Filipino driver, wherever they may be.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ecommerceBenefits.map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <div key={index} className="bg-white rounded-2xl border border-gray-200 p-8 shadow-md hover:shadow-xl transition-all duration-300 group">
                <div className="mb-6">
                  <div className="w-16 h-16 rounded-xl bg-yellow-100 flex items-center justify-center group-hover:bg-yellow-200 transition">
                    <Icon className="h-8 w-8 text-yellow-600" />
                  </div>
                </div>
                <h3 className="font-bold text-xl text-black mb-3">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-16 bg-gradient-to-r from-black to-gray-900 rounded-2xl p-12 text-center shadow-xl">
          <p className="text-white text-xl md:text-2xl font-medium leading-relaxed">
            "ROCARS is revolutionizing the auto parts industry by bringing our trusted products and services online, 
            making quality automotive care accessible to drivers across the Philippines."
          </p>
          <p className="text-yellow-400 mt-6 font-semibold">- ROCARS Team</p>
        </div>
      </section>


    </div>
  )
}