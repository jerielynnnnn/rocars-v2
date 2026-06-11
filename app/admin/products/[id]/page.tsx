'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { logAdminActivity } from '@/lib/admin-activity';
import { ArrowLeft, X, Plus, Loader2, Tag, Percent } from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface ProductImage {
  id: number;
  image_url: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    description: '',
    price: '',
    stock: '',
    sku: '',
    category_id: '',
    is_active: true,
    is_on_sale: false,
    sale_price: '',
    discount_percent: ''
  });

  useEffect(() => {
    fetchProduct();
    fetchCategories();
  }, [productId]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;

      console.log('Fetched product:', {
        is_on_sale: product.is_on_sale,
        sale_price: product.sale_price,
        discount_percent: product.discount_percent
      });

      setFormData({
        name: product.name,
        brand: product.brand || '',
        description: product.description || '',
        price: product.price.toString(),
        stock: product.stock.toString(),
        sku: product.sku || '',
        category_id: product.category_id?.toString() || '',
        is_active: product.is_active,
        is_on_sale: product.is_on_sale === true,
        sale_price: product.sale_price?.toString() || '',
        discount_percent: product.discount_percent?.toString() || ''
      });

      const { data: images } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId);

      setExistingImages(images || []);
    } catch (error) {
      console.error('Error fetching product:', error);
      alert('Product not found');
      router.push('/admin/products');
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

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Admin session expired. Please login again.');
    }
    return session.access_token;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = existingImages.length + newImages.length + files.length;
    
    if (totalImages > 5) {
      alert('Maximum 5 images per product');
      return;
    }
    
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} exceeds 5MB limit`);
        return false;
      }
      return true;
    });
    
    setNewImages([...newImages, ...validFiles]);
    
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setNewImagePreviews([...newImagePreviews, ...newPreviews]);
  };

  const removeExistingImage = async (imageId: number, imageUrl: string) => {
    const urlParts = imageUrl.split('/');
    const filePath = urlParts.slice(urlParts.indexOf('product-images') + 1).join('/');
    
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('product-images')
        .remove([filePath]);
      
      if (storageError) {
        console.error('Storage delete error:', storageError);
      }
    }
    
    const accessToken = await getAccessToken();
    const response = await fetch(`/api/admin/product-images?id=${imageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      alert('Error deleting image: ' + (result.error || 'Failed to delete image'));
      return;
    }

    await logAdminActivity({
      action: 'DELETE_PRODUCT_IMAGE',
      target_type: 'product',
      target_id: productId,
      details: { image_id: imageId },
    });

    setExistingImages(existingImages.filter(img => img.id !== imageId));
  };

  const removeNewImage = (index: number) => {
    URL.revokeObjectURL(newImagePreviews[index]);
    setNewImages(newImages.filter((_, i) => i !== index));
    setNewImagePreviews(newImagePreviews.filter((_, i) => i !== index));
  };

  const uploadNewImages = async (): Promise<boolean> => {
    if (newImages.length === 0) return true;
    
    setUploadingImages(true);
    setUploadError('');
    
    try {
      for (let i = 0; i < newImages.length; i++) {
        const file = newImages[i];
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const fileName = `product_${productId}/${timestamp}_${random}_${i}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          console.error('Upload error details:', uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        const accessToken = await getAccessToken();
        const response = await fetch('/api/admin/product-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            product_id: parseInt(productId),
            image_url: publicUrl,
          }),
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error('DB insert error:', result);
          throw new Error(`Database insert failed: ${result.error || 'Failed to save image'}`);
        }
        
        console.log('Successfully uploaded:', fileName);
      }
      
      newImagePreviews.forEach(preview => URL.revokeObjectURL(preview));
      setNewImages([]);
      setNewImagePreviews([]);
      
      const { data: updatedImages } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId);
      
      setExistingImages(updatedImages || []);
      
      return true;
    } catch (error: any) {
      console.error('Error uploading images:', error);
      setUploadError(error.message);
      return false;
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSaleToggle = (checked: boolean) => {
    console.log('Sale toggled:', checked);
    setFormData({ ...formData, is_on_sale: checked });
    if (!checked) {
      setFormData(prev => ({ ...prev, sale_price: '', discount_percent: '' }));
    }
  };

  const handlePriceChange = (price: string) => {
    setFormData({ ...formData, price: price });
    
    // Auto-calculate discount if sale price exists
    if (formData.is_on_sale && formData.sale_price) {
      const originalPrice = parseFloat(price);
      const salePrice = parseFloat(formData.sale_price);
      if (originalPrice > 0 && salePrice > 0 && salePrice < originalPrice) {
        const discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
        setFormData(prev => ({ ...prev, discount_percent: discount.toString() }));
      }
    }
  };

  const handleSalePriceChange = (salePrice: string) => {
    setFormData({ ...formData, sale_price: salePrice });
    
    const originalPrice = parseFloat(formData.price);
    const salePriceNum = parseFloat(salePrice);
    if (originalPrice > 0 && salePriceNum > 0 && salePriceNum < originalPrice) {
      const discount = Math.round(((originalPrice - salePriceNum) / originalPrice) * 100);
      setFormData(prev => ({ ...prev, discount_percent: discount.toString() }));
    } else if (salePriceNum >= originalPrice && originalPrice > 0) {
      alert('Sale price must be less than regular price');
      setFormData(prev => ({ ...prev, sale_price: '', discount_percent: '' }));
    }
  };

  const handleDiscountPercentChange = (percent: string) => {
    const discountPercent = parseFloat(percent);
    const originalPrice = parseFloat(formData.price);
    
    if (originalPrice > 0 && discountPercent > 0 && discountPercent <= 100) {
      const salePrice = originalPrice * (1 - discountPercent / 100);
      setFormData(prev => ({ 
        ...prev, 
        discount_percent: percent,
        sale_price: salePrice.toFixed(2)
      }));
    } else if (discountPercent > 100) {
      alert('Discount percent cannot exceed 100%');
    } else if (discountPercent < 0) {
      alert('Discount percent cannot be negative');
    } else {
      setFormData(prev => ({ ...prev, discount_percent: percent }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setUploadError('');

    try {
      // Validation
      if (!formData.name) throw new Error('Product name is required');
      if (!formData.price) throw new Error('Price is required');
      if (!formData.category_id) throw new Error('Category is required');
      
      const slug = generateSlug(formData.name);
      
      // Prepare update data - CRITICAL: Ensure sale_price is properly set
      const updateData: any = {
        name: formData.name,
        slug: slug,
        brand: formData.brand || null,
        description: formData.description || null,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock) || 0,
        sku: formData.sku || null,
        category_id: parseInt(formData.category_id),
        is_active: formData.is_active,
        is_on_sale: formData.is_on_sale === true
      };

      // IMPORTANT: Handle sale data correctly
      if (formData.is_on_sale === true) {
        if (!formData.sale_price || formData.sale_price === '') {
          throw new Error('Sale price is required when product is on sale');
        }
        const salePriceNum = parseFloat(formData.sale_price);
        const discountNum = parseInt(formData.discount_percent) || 0;
        
        if (isNaN(salePriceNum)) {
          throw new Error('Invalid sale price');
        }
        
        updateData.sale_price = salePriceNum;
        updateData.discount_percent = discountNum;
        
        console.log('Setting sale data:', {
          sale_price: salePriceNum,
          discount_percent: discountNum
        });
      } else {
        // Clear sale data when not on sale
        updateData.sale_price = null;
        updateData.discount_percent = null;
      }

      console.log('Final update data:', updateData);

      const accessToken = await getAccessToken();
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ product: updateData }),
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : {};

      if (!response.ok) {
        console.error('Product update API error:', {
          status: response.status,
          statusText: response.statusText,
          result,
          responseText,
        });
        throw new Error(result.error || responseText || 'Failed to update product');
      }

      console.log('Product updated successfully:', result.product);

      await logAdminActivity({
        action: 'UPDATE_PRODUCT',
        target_type: 'product',
        target_id: productId,
        details: { name: updateData.name, sku: updateData.sku, stock: updateData.stock },
      });

      // Upload new images if any
      if (newImages.length > 0) {
        const uploadSuccess = await uploadNewImages();
        if (!uploadSuccess) {
          alert('Product updated successfully, but some images failed to upload.');
          router.push('/admin/products');
          return;
        }
      }

      alert('Product updated successfully!');
      router.push('/admin/products');
    } catch (error: any) {
      console.error('Error updating product:', error);
      alert('Error updating product: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-gray-500 mt-1">Update product information</p>
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Upload Error:</p>
          <p className="text-sm">{uploadError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">Product Images (Max 5)</h2>
            
            {existingImages.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Current Images</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {existingImages.map((image) => (
                    <div key={image.id} className="relative group">
                      <img src={image.image_url} alt="Product" className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                      <div className="absolute top-2 right-2">
                        <button
                          type="button"
                          onClick={() => removeExistingImage(image.id, image.image_url)}
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {newImagePreviews.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">New Images to Upload</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {newImagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => removeNewImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {existingImages.length + newImages.length < 5 && (
              <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-black transition">
                <div className="text-center">
                  <Plus className="w-6 h-6 text-gray-400 mx-auto" />
                  <span className="text-sm text-gray-500">Add Image</span>
                  <span className="text-xs text-gray-400 block">(Max 5MB each)</span>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageUpload} className="hidden" />
              </label>
            )}
            
            {uploadingImages && (
              <div className="mt-4 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-black mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Uploading images...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">Pricing & Stock</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regular Price (PHP) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-gray-700">Put on Sale / Promo</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.is_on_sale === true}
                      onChange={(e) => handleSaleToggle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 rounded-full transition-all duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${
                      formData.is_on_sale === true 
                        ? 'bg-red-500 after:translate-x-full' 
                        : 'bg-gray-200 after:translate-x-0'
                    }`}></div>
                  </div>
                </label>
              </div>

              {formData.is_on_sale === true && (
                <div className="space-y-4 bg-red-50 p-4 rounded-lg border border-red-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">Promo Details</span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (PHP) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.sale_price}
                      onChange={(e) => handleSalePriceChange(e.target.value)}
                      className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder={`Less than ${formData.price || 'original price'}`}
                    />
                    {formData.sale_price && parseFloat(formData.sale_price) >= parseFloat(formData.price) && (
                      <p className="text-xs text-red-500 mt-1">Sale price must be less than regular price</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Percentage (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={formData.discount_percent}
                      onChange={(e) => handleDiscountPercentChange(e.target.value)}
                      className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="e.g., 25"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.price && formData.sale_price && parseFloat(formData.sale_price) > 0
                        ? `Customer saves: ₱${(parseFloat(formData.price) - parseFloat(formData.sale_price)).toFixed(2)}`
                        : 'Auto-calculated from sale price'}
                    </p>
                  </div>

                  <div className="mt-2 pt-2 border-t border-red-200">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">Display price on store:</span>
                      <span className="text-red-600 font-bold line-through">₱{parseFloat(formData.price).toLocaleString()}</span>
                      <span className="text-green-600 font-bold">₱{parseFloat(formData.sale_price || formData.price).toLocaleString()}</span>
                      {formData.discount_percent && (
                        <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-bold">-{formData.discount_percent}%</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">Category</h2>
            <select
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">Status</h2>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Active Product</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </div>
            </label>
          </div>

          <div className="flex gap-3">
            <Link href="/admin/products" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || uploadingImages}
              className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {saving || uploadingImages ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
