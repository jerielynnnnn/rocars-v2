'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Star,
  Search,
  Trash2,
  Eye,
  MessageSquare,
  User,
  Package,
  ChevronDown,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface Review {
  id: number
  user_id: string
  product_id: number
  rating: number
  comment: string
  created_at: string
  user?: {
    username: string
    first_name: string
    last_name: string
    avatar_url: string
    email: string
  }
  product?: {
    name: string
    slug: string
  }
}

interface OrderRating {
  id: number
  order_id: number
  user_id: string
  rating: number
  comment: string
  created_at: string
  user?: {
    username: string
    first_name: string
    last_name: string
  }
  order?: {
    total_amount: number
  }
}

const ITEMS_PER_PAGE = 10

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [orderRatings, setOrderRatings] = useState<OrderRating[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'product' | 'order'>('product')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRating, setFilterRating] = useState<number | 'all'>('all')
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchReviews()
    fetchOrderRatings()
  }, [])

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:profiles!reviews_user_id_fkey (
            username,
            first_name,
            last_name,
            avatar_url,
            email
          ),
          product:products (
            id,
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform the data to handle potential array responses
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        user: Array.isArray(item.user) ? item.user[0] : item.user,
        product: Array.isArray(item.product) ? item.product[0] : item.product,
      }))
      
      setReviews(transformedData)
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrderRatings = async () => {
    try {
      console.log('Fetching order ratings...')
      
      // Fetch order ratings without joins first to avoid TypeScript issues
      const { data, error } = await supabase
        .from('order_ratings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching order ratings:', error)
        setOrderRatings([])
        return
      }

      if (!data || data.length === 0) {
        console.log('No order ratings found')
        setOrderRatings([])
        return
      }

      // Get unique user IDs to fetch profiles
      const userIds = [...new Set(data.map(rating => rating.user_id).filter(Boolean))]
      
      // Fetch profiles for these users
      let profilesMap = new Map()
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name')
          .in('id', userIds)

        if (!profilesError && profiles) {
          profilesMap = new Map(profiles.map(profile => [profile.id, profile]))
        }
      }

      // Transform the data to include user profiles
      const transformedData: OrderRating[] = data.map(rating => ({
        id: rating.id,
        order_id: rating.order_id,
        user_id: rating.user_id,
        rating: rating.rating,
        comment: rating.comment,
        created_at: rating.created_at,
        user: profilesMap.get(rating.user_id),
      }))

      console.log('Order ratings fetched successfully:', transformedData.length)
      setOrderRatings(transformedData)
    } catch (error: any) {
      console.error('Unexpected error fetching order ratings:', error?.message || error)
      setOrderRatings([])
    }
  }


  const handleDeleteReview = async (id: number) => {
  // Determine which table to delete from based on active tab
  const tableName = activeTab === 'product' ? 'reviews' : 'order_ratings'
  const itemName = activeTab === 'product' ? 'review' : 'rating'
  
  console.log('=== DELETE DEBUG ===')
  console.log('Table:', tableName)
  console.log('ID to delete:', id)
  console.log('Active tab:', activeTab)
  
  if (!confirm(`Delete this ${itemName}? This action cannot be undone.`)) return
  
  try {
    // First, check if the record exists and get its data
    const { data: existingData, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single()
    
    console.log('Existing record check:', { existingData, fetchError })
    
    if (fetchError) {
      console.error('Record not found:', fetchError)
      alert(`Record with ID ${id} not found in ${tableName} table`)
      return
    }
    
    console.log('Record exists, attempting delete...')
    
    // Perform the delete
    const { data: deletedData, error: deleteError, status, statusText } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
      .select()
    
    console.log('Delete response:', { 
      deletedData, 
      deleteError, 
      status, 
      statusText,
      errorCode: deleteError?.code,
      errorMessage: deleteError?.message,
      errorDetails: deleteError?.details,
      errorHint: deleteError?.hint
    })
    
    if (deleteError) {
      console.error(`Error deleting ${itemName}:`, deleteError)
      
      // Check for specific error types
      if (deleteError.code === '42501') {
        alert(`Permission denied: You don't have DELETE permission on ${tableName} table. Contact an administrator.`)
      } else if (deleteError.code === '23503') {
        alert(`Cannot delete: This ${itemName} is referenced by other records.`)
      } else {
        alert(`Failed to delete ${itemName}: ${deleteError.message}`)
      }
      return
    }
    
    if (!deletedData || deletedData.length === 0) {
      console.warn('Delete seemed successful but no data was returned')
      alert(`${itemName} may not have been deleted. Please refresh and check.`)
      return
    }
    
    console.log(`Successfully deleted ${itemName}:`, deletedData)
    
    // Update the correct state based on active tab
    if (activeTab === 'product') {
      setReviews(prev => prev.filter(r => r.id !== id))
      setSelectedReview(null)
    } else {
      setOrderRatings(prev => prev.filter(r => r.id !== id))
    }
    
    alert(`${itemName} deleted successfully!`)
    
    // Optional: Refresh to verify
    if (activeTab === 'product') {
      await fetchReviews()
    } else {
      await fetchOrderRatings()
    }
    
  } catch (error: any) {
    console.error(`Unexpected error deleting ${itemName}:`, error)
    alert(`Failed to delete ${itemName}: ${error?.message || 'Unknown error'}`)
  }
}

  const filteredReviews = useMemo(() => {
    return reviews.filter(review => {
      const matchesSearch = 
        review.comment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.product?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesRating = filterRating === 'all' || review.rating === filterRating
      
      return matchesSearch && matchesRating
    })
  }, [reviews, searchTerm, filterRating])

  const filteredOrderRatings = useMemo(() => {
    return orderRatings.filter(rating => {
      const matchesSearch = 
        rating.comment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rating.user?.username?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesRating = filterRating === 'all' || rating.rating === filterRating
      
      return matchesSearch && matchesRating
    })
  }, [orderRatings, searchTerm, filterRating])

  const currentData = activeTab === 'product' ? filteredReviews : filteredOrderRatings
  const totalPages = Math.ceil(currentData.length / ITEMS_PER_PAGE)
  const paginatedData = currentData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const stats = {
    total: reviews.length,
    average: reviews.length > 0 
      ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
      : '0',
    fiveStar: reviews.filter(r => r.rating === 5).length,
    orderRatingsTotal: orderRatings.length,
  }

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  )

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600'
    if (rating >= 3) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-12 w-12 animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reviews Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer reviews and ratings</p>
        </div>

        <button
          onClick={() => {
            fetchReviews()
            fetchOrderRatings()
          }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Reviews</p>
              <h2 className="text-2xl font-bold mt-1">{stats.total}</h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-black text-white flex items-center justify-center">
              <MessageSquare className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average Rating</p>
              <h2 className="text-2xl font-bold mt-1">{stats.average}</h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center">
              <Star className="h-6 w-6 fill-yellow-500" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">5-Star Reviews</p>
              <h2 className="text-2xl font-bold mt-1">{stats.fiveStar}</h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
              <Star className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Order Ratings</p>
              <h2 className="text-2xl font-bold mt-1">{stats.orderRatingsTotal}</h2>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Package className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => {
              setActiveTab('product')
              setCurrentPage(1)
              setSearchTerm('')
              setFilterRating('all')
            }}
            className={`pb-3 text-sm font-medium transition ${
              activeTab === 'product'
                ? 'text-black border-b-2 border-black'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Product Reviews
          </button>
          <button
            onClick={() => {
              setActiveTab('order')
              setCurrentPage(1)
              setSearchTerm('')
              setFilterRating('all')
            }}
            className={`pb-3 text-sm font-medium transition ${
              activeTab === 'order'
                ? 'text-black border-b-2 border-black'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Order Ratings
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search reviews..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <select
          value={filterRating}
          onChange={(e) => {
            setFilterRating(e.target.value === 'all' ? 'all' : parseInt(e.target.value))
            setCurrentPage(1)
          }}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="all">All Ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Customer
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  {activeTab === 'product' ? 'Product' : 'Order'}
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Rating
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Review
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Date
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    No reviews found
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.user?.first_name} {item.user?.last_name}
                          </p>
                          <p className="text-xs text-gray-500">@{item.user?.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {activeTab === 'product' ? (
                        <p className="text-sm font-medium text-gray-900">
                          {(item as Review).product?.name || 'Unknown Product'}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-900">Order #{(item as OrderRating).order_id}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {renderStars(item.rating)}
                        <span className={`text-xs font-medium ${getRatingColor(item.rating)}`}>
                          {item.rating}.0
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {item.comment || 'No comment'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {activeTab === 'product' && (
                          <button
                            onClick={() => setSelectedReview(item as Review)}
                            className="p-2 text-gray-500 hover:text-black transition"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReview(item.id)}
                          className="p-2 text-gray-500 hover:text-red-500 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, currentData.length)} of {currentData.length} reviews
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="h-10 w-10 border border-gray-200 rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-gray-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="px-4 py-2 text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="h-10 w-10 border border-gray-200 rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-gray-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Review Details</h2>
                <p className="text-sm text-gray-500 mt-1">Product: {selectedReview.product?.name || 'Unknown'}</p>
              </div>
              <button
                onClick={() => setSelectedReview(null)}
                className="h-10 w-10 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              >
                X
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-semibold mt-1">
                    {selectedReview.user?.first_name} {selectedReview.user?.last_name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">@{selectedReview.user?.username}</p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-semibold mt-1 break-all">{selectedReview.user?.email}</p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Rating</p>
                  <div className="mt-2">{renderStars(selectedReview.rating)}</div>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-semibold mt-1">
                    {new Date(selectedReview.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Review Comment</p>
                <p className="text-gray-700 mt-2">{selectedReview.comment || 'No comment provided'}</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => handleDeleteReview(selectedReview.id)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition"
              >
                Delete Review
              </button>
              <button
                onClick={() => setSelectedReview(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
