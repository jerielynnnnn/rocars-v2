'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  Tag,
  Percent
} from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: number;
  name: string;
  slug: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    brand: '',
    price: '',
    stock: '',
    sku: '',
    category_id: '',
    is_on_sale: false,
    sale_price: '',
    discount_percent: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*');

      if (error) {
        console.error('Error fetching categories:', error);
        setErrors(prev => ({ ...prev, categories: error.message }));
      } else {
        setCategories(data || []);
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setErrors(prev => ({ ...prev, categories: err.message }));
    } finally {
      setLoadingCategories(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'name' && { slug: generateSlug(value) })
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSaleToggle = (checked: boolean) => {
    setFormData({ ...formData, is_on_sale: checked });
    if (!checked) {
      setFormData(prev => ({ ...prev, sale_price: '', discount_percent: '' }));
    }
  };

  const handlePriceChange = (price: string) => {
    setFormData({ ...formData, price: price });
    
    if (formData.is_on_sale && formData.sale_price) {
      const originalPrice = parseFloat(price);
      const salePrice = parseFloat(formData.sale_price);
      if (originalPrice > 0 && salePrice > 0) {
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Max size is 5MB.`);
        return false;
      }
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file.`);
        return false;
      }
      return true;
    });

    setImageFiles(prev => [...prev, ...validFiles]);
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (productId: number): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of imageFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Product name is required';
    if (!formData.price) newErrors.price = 'Price is required';
    if (Number(formData.price) <= 0) newErrors.price = 'Price must be greater than 0';
    if (!formData.category_id) newErrors.category_id = 'Category is required';
    if (formData.is_on_sale && !formData.sale_price) {
      newErrors.sale_price = 'Sale price is required when product is on sale';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    
    try {
      const baseSlug = formData.slug || generateSlug(formData.name);
      const timestamp = Date.now();
      const uniqueSlug = `${baseSlug}-${timestamp}`;
      
      let finalSku = formData.sku;
      if (!finalSku || finalSku.trim() === '') {
        const skuBase = formData.name
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 8);
        finalSku = `${skuBase}-${timestamp}`;
      } else {
        const { data: existingSku } = await supabase
          .from('products')
          .select('sku')
          .eq('sku', finalSku)
          .single();
        
        if (existingSku) {
          finalSku = `${finalSku}-${timestamp}`;
        }
      }
      
      const productData: any = {
        name: formData.name,
        slug: uniqueSlug,
        description: formData.description || null,
        brand: formData.brand || null,
        price: Number(formData.price),
        stock: Number(formData.stock) || 0,
        sku: finalSku,
        category_id: Number(formData.category_id),
        is_active: true,
        is_on_sale: formData.is_on_sale
      };

      if (formData.is_on_sale) {
        productData.sale_price = Number(formData.sale_price);
        productData.discount_percent = Number(formData.discount_percent) || 0;
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (productError) {
        console.error('Product insert error:', productError);
        throw new Error(`Product insert failed: ${productError.message}`);
      }

      if (imageFiles.length > 0) {
        try {
          const imageUrls = await uploadImages(product.id);
          
          if (imageUrls.length > 0) {
            const imageInserts = imageUrls.map(url => ({
              product_id: product.id,
              image_url: url
            }));
            
            const { error: imagesError } = await supabase
              .from('product_images')
              .insert(imageInserts);

            if (imagesError) {
              console.error('Image insert error:', imagesError);
              alert(`Product created but images failed to upload: ${imagesError.message}\nYou can add images later by editing the product.`);
            }
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          alert(`Product created but images failed to upload: ${uploadError.message}\nYou can add images later by editing the product.`);
        }
      }

      alert('Product created successfully!');
      router.push('/admin/products');
      router.refresh();
      
    } catch (error: any) {
      console.error('Error creating product:', error);
      alert('Error creating product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-500 mt-1">Create a new product for your store</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="auto-generated-from-name"
              />
              <p className="text-xs text-gray-500 mt-1">URL-friendly version of the name. Leave empty to auto-generate.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                {loadingCategories ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-500">Loading categories...</span>
                  </div>
                ) : (
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                      errors.category_id ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                )}
                {errors.category_id && <p className="text-xs text-red-500 mt-1">{errors.category_id}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Pricing & Inventory</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regular Price (PHP) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  step="0.01"
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                    errors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
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
                    checked={formData.is_on_sale}
                    onChange={(e) => handleSaleToggle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </div>
              </label>
            </div>

            {formData.is_on_sale && (
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
                    required={formData.is_on_sale}
                    value={formData.sale_price}
                    onChange={(e) => handleSalePriceChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                      errors.sale_price ? 'border-red-500' : 'border-red-300'
                    }`}
                    placeholder={`Less than ${formData.price || 'original price'}`}
                  />
                  {errors.sale_price && <p className="text-xs text-red-500 mt-1">{errors.sale_price}</p>}
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
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
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
                    <span className="text-red-600 font-bold line-through">₱{parseFloat(formData.price || '0').toLocaleString()}</span>
                    <span className="text-green-600 font-bold">₱{parseFloat(formData.sale_price || formData.price || '0').toLocaleString()}</span>
                    {formData.discount_percent && (
                      <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-bold">-{formData.discount_percent}%</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU (Optional)</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Leave empty to auto-generate"
                />
                <p className="text-xs text-gray-500 mt-1">If left empty, a unique SKU will be generated automatically.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Product Images</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Images (max 5MB each)</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Click to upload images</p>
                  <p className="text-xs text-gray-400">PNG, JPG, GIF up to 5MB</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4 pb-6">
          <Link href="/admin/products" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? 'Creating...' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}