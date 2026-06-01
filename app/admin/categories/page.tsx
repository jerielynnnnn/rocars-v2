'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Check,
  X,
  Search,
  FolderOpen,
  Image as ImageIcon,
  Upload,
  Trash,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  image_url?: string;
  product_count?: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    image_url: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);

    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (categoriesError) throw categoriesError;

      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id);

          return {
            ...category,
            product_count: count || 0,
          };
        })
      );

      setCategories(categoriesWithCounts);
    } catch (error) {
      console.error('Error fetching categories:', error);
      alert('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'name' && !editingCategory
        ? { slug: generateSlug(value) }
        : {}),
    }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();

      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;

      const filePath = `categories/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error(error);
      alert('Failed to upload image');
      return null;
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    setUploadingImage(true);

    const reader = new FileReader();

    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };

    reader.readAsDataURL(file);

    const imageUrl = await uploadImage(file);

    if (imageUrl) {
      setFormData((prev) => ({
        ...prev,
        image_url: imageUrl,
      }));
    }

    setUploadingImage(false);
  };

  const removeImage = () => {
    setFormData((prev) => ({
      ...prev,
      image_url: '',
    }));

    setImagePreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    }

    if (!formData.slug.trim()) {
      errors.slug = 'Slug is required';
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            slug: formData.slug,
            image_url: formData.image_url || null,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;

        alert('Category updated successfully');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([
            {
              name: formData.name.trim(),
              slug: formData.slug,
              image_url: formData.image_url || null,
            },
          ]);

        if (error) throw error;

        alert('Category created successfully');
      }

      resetForm();
      fetchCategories();
    } catch (error: any) {
      console.error(error);

      if (error.code === '23505') {
        alert('Category already exists');
      } else {
        alert('Failed to save category');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);

    try {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id);

      if (count && count > 0) {
        alert(`Cannot delete: ${count} product(s) exist`);
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchCategories();
      setDeleteConfirm(null);

      alert('Deleted successfully');
    } catch (error) {
      console.error(error);
      alert('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      image_url: '',
    });

    setEditingCategory(null);
    setFormErrors({});
    setImagePreview(null);
    setIsModalOpen(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);

    setFormData({
      name: category.name,
      slug: category.slug,
      image_url: category.image_url || '',
    });

    setImagePreview(category.image_url || null);

    setIsModalOpen(true);
  };

  const filteredCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // PAGINATION
  const totalPages = Math.ceil(
    filteredCategories.length / itemsPerPage
  );

  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-10 w-10 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Categories
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage product categories
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {/* SEARCH */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col lg:flex-row justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />

          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span>
              Total:
              <strong className="ml-1 text-black">
                {categories.length}
              </strong>
            </span>
          </div>

          <div>
            Active:
            <strong className="ml-1 text-black">
              {
                categories.filter(
                  (c) => c.product_count && c.product_count > 0
                ).length
              }
            </strong>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">

            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Image
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Name
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Slug
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Products
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Created
                </th>

                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {paginatedCategories.map((category) => (
                <tr
                  key={category.id}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4">
                    {category.image_url ? (
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="h-12 w-12 rounded-xl object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200">
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 font-medium text-gray-900">
                    {category.name}
                  </td>

                  <td className="px-6 py-4">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      /{category.slug}
                    </code>
                  </td>

                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {category.product_count || 0}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(
                      category.created_at
                    ).toLocaleDateString()}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">

                      <button
                        onClick={() => openEditModal(category)}
                        className="p-2 rounded-lg hover:bg-gray-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      {deleteConfirm === category.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(category.id)}
                            disabled={deleting}
                            className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                          >
                            <Check className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="p-2 rounded-lg hover:bg-gray-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() =>
                            setDeleteConfirm(category.id)
                          }
                          className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}

                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          <p className="text-sm text-gray-500">
            Showing page {currentPage} of {totalPages}
          </p>

          <div className="flex items-center gap-2">

            <button
              onClick={() =>
                setCurrentPage((prev) =>
                  Math.max(prev - 1, 1)
                )
              }
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>

            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index + 1)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition ${
                  currentPage === index + 1
                    ? 'bg-black text-white'
                    : 'border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {index + 1}
              </button>
            ))}

            <button
              onClick={() =>
                setCurrentPage((prev) =>
                  Math.min(prev + 1, totalPages)
                )
              }
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-100 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>

          </div>
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

            <div className="p-6">

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  {editingCategory
                    ? 'Edit Category'
                    : 'Create Category'}
                </h2>

                <button
                  onClick={resetForm}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* IMAGE */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category Image
                  </label>

                  <div className="flex items-start gap-4">

                    <div>
                      {imagePreview ? (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-24 h-24 rounded-xl object-cover border"
                          />

                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center border">
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="upload-image"
                      />

                      <label
                        htmlFor="upload-image"
                        className="flex items-center justify-center gap-2 px-4 py-3 border rounded-xl cursor-pointer hover:bg-gray-50"
                      >
                        {uploadingImage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}

                        {uploadingImage
                          ? 'Uploading...'
                          : 'Upload Image'}
                      </label>

                      <p className="text-xs text-gray-500 mt-2">
                        PNG/JPG up to 2MB
                      </p>
                    </div>

                  </div>
                </div>

                {/* NAME */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category Name
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Engine Parts"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                {/* SLUG */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Slug
                  </label>

                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                {/* BUTTONS */}
                <div className="flex gap-3 pt-2">

                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-3 rounded-xl border border-gray-200 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || uploadingImage}
                    className="flex-1 py-3 rounded-xl bg-black text-white hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {(submitting || uploadingImage) && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {editingCategory ? 'Update' : 'Create'}
                  </button>

                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}