'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAdminActivity } from '@/lib/admin-activity';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Package,
  Tag,
  AlertCircle,
  Loader2,
  ChevronDown,
  RefreshCw,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  Clock,
  Percent
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  slug: string;
  brand: string;
  price: number;
  sale_price: number | null;
  discount_percent: number | null;
  is_on_sale: boolean;
  stock: number;
  sku: string;
  is_active: boolean;
  category_id: number;
  created_at: string;
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  product_images?: { image_url: string }[];
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [saleFilter, setSaleFilter] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    setupRealtimeSubscription();
    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories!products_category_id_fkey (
            id,
            name,
            slug
          ),
          product_images (
            image_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    setCategories(data || []);
  };

  const setupRealtimeSubscription = () => {
    const productsSubscription = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProduct = payload.new as Product;
            setProducts(prev => [newProduct, ...prev]);
            setIsRealtimeConnected(true);
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedProduct = payload.new as Product;
            setProducts(prev => prev.map(product => 
              product.id === updatedProduct.id ? updatedProduct : product
            ));
            setIsRealtimeConnected(true);
          } 
          else if (payload.eventType === 'DELETE') {
            const deletedProduct = payload.old as Product;
            setProducts(prev => prev.filter(product => product.id !== deletedProduct.id));
            setIsRealtimeConnected(true);
          }
          setLastUpdated(new Date());
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR') {
          setIsRealtimeConnected(false);
        }
      });

    const imagesSubscription = supabase
      .channel('product-images-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_images'
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      productsSubscription.unsubscribe();
      imagesSubscription.unsubscribe();
    };
  };

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Admin session expired. Please login again.');
    }
    return session.access_token;
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    setDeleting(true);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/admin/products/${selectedProduct.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete product');
      }

      await logAdminActivity({
        action: 'DELETE_PRODUCT',
        target_type: 'product',
        target_id: selectedProduct.id,
        details: { name: selectedProduct.name, sku: selectedProduct.sku },
      });

      setShowDeleteModal(false);
      setSelectedProduct(null);
    } catch (error: any) {
      alert('Error deleting product: ' + error.message);
      await fetchProducts();
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (productId: number, currentStatus: boolean) => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ product: { is_active: !currentStatus } }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update product status');
      }

      await logAdminActivity({
        action: 'UPDATE_PRODUCT_STATUS',
        target_type: 'product',
        target_id: productId,
        details: { is_active: !currentStatus },
      });
      
      setProducts(products.map(p => 
        p.id === productId ? { ...p, is_active: !currentStatus } : p
      ));
    } catch (error: any) {
      alert('Error updating product status: ' + error.message);
      await fetchProducts();
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const getDisplayPrice = (product: Product) => {
    if (product.is_on_sale && product.sale_price) {
      return product.sale_price;
    }
    return product.price;
  };

  const getOriginalPrice = (product: Product) => {
    if (product.is_on_sale && product.sale_price) {
      return product.price;
    }
    return null;
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (stock < 10) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || product.category_id.toString() === categoryFilter;
    
    const matchesStock = stockFilter === 'all' || 
                         (stockFilter === 'in_stock' && product.stock > 10) ||
                         (stockFilter === 'low_stock' && product.stock > 0 && product.stock <= 10) ||
                         (stockFilter === 'out_of_stock' && product.stock === 0);
    
    const matchesSale = saleFilter === 'all' ||
                        (saleFilter === 'on_sale' && product.is_on_sale === true) ||
                        (saleFilter === 'not_on_sale' && (product.is_on_sale === false || product.is_on_sale === null));
    
    return matchesSearch && matchesCategory && matchesStock && matchesSale;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1">Manage your product inventory, prices, and details</p>
        </div>
        <div className="flex gap-2">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            isRealtimeConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {isRealtimeConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="hidden md:inline">Live Updates</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="hidden md:inline">Reconnecting...</span>
              </>
            )}
          </div>
          
          <div className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
          
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
          >
            <Plus className="w-5 h-5" />
            Add New Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
            />
          </div>

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black appearance-none bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>

          <div className="relative">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black appearance-none bg-white"
            >
              <option value="all">All Stock Status</option>
              <option value="in_stock">In Stock (&gt;10)</option>
              <option value="low_stock">Low Stock (1-10)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
            <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>

          <div className="relative">
            <select
              value={saleFilter}
              onChange={(e) => setSaleFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black appearance-none bg-white"
            >
              <option value="all">All Products</option>
              <option value="on_sale">On Sale</option>
              <option value="not_on_sale">Not on Sale</option>
            </select>
            <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product.stock);
                const displayPrice = getDisplayPrice(product);
                const originalPrice = getOriginalPrice(product);
                const isOnSale = product.is_on_sale && product.sale_price;
                
                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={product.product_images?.[0]?.image_url || '/placeholder-product.png'}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{product.name}</p>
                            {isOnSale && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                <Percent className="w-3 h-3" />
                                {product.discount_percent}% OFF
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{product.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm">{product.sku || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">{product.category?.name || 'Uncategorized'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {isOnSale ? (
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice!)}</span>
                          <span className="font-semibold text-red-600">{formatPrice(displayPrice)}</span>
                        </div>
                      ) : (
                        <span className="font-semibold">{formatPrice(displayPrice)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                        <span className="text-sm font-medium">{product.stock} units</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(product.id, product.is_active)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          product.is_active 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {product.is_active ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {product.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="p-2 text-gray-600 hover:text-black rounded-lg hover:bg-gray-100 transition"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/products/${product.slug}`}
                          target="_blank"
                          className="p-2 text-gray-600 hover:text-black rounded-lg hover:bg-gray-100 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold">Delete Product</h2>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete <strong>{selectedProduct.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. This will also delete all product images and remove it from all orders.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
