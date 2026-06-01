import { supabase } from './supabase';

const BUCKET_NAME = 'product-images';

export async function uploadProductImage(file: File, productId: number): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrl;
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  // Extract file path from URL
  const urlParts = imageUrl.split('/');
  const filePath = urlParts.slice(urlParts.indexOf('product-images') + 1).join('/');
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) throw error;
}

export async function deleteAllProductImages(productId: number): Promise<void> {
  const { data: images } = await supabase
    .from('product_images')
    .select('image_url')
    .eq('product_id', productId);

  if (images && images.length > 0) {
    const filePaths = images.map(img => {
      const urlParts = img.image_url.split('/');
      return urlParts.slice(urlParts.indexOf('product-images') + 1).join('/');
    });
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (error) throw error;
  }
}