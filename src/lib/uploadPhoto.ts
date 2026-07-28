import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

// base64 → ArrayBuffer (בלי תלות חיצונית) כדי להעלות ל-Supabase Storage מ-RN
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let len = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') len--;
  if (base64[base64.length - 2] === '=') len--;
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const e1 = lookup[base64.charCodeAt(i)];
    const e2 = lookup[base64.charCodeAt(i + 1)];
    const e3 = lookup[base64.charCodeAt(i + 2)];
    const e4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (base64[i + 2] !== '=') bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (base64[i + 3] !== '=') bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes.buffer;
}

/**
 * בוחר תמונה מהגלריה ומעלה ל-Supabase Storage (bucket "photos").
 * מחזיר { url } בהצלחה, {} אם בוטל, או { error } בכשל.
 */
export async function pickAndUploadPhoto(prefix: string): Promise<{ url?: string; error?: string }> {
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true, allowsEditing: true, aspect: [4, 3] });
  const asset = res.assets?.[0];
  if (res.canceled || !asset?.base64) return {};
  const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${prefix}/${Date.now()}-${Math.round(asset.fileSize ?? 0)}.${ext === 'png' || ext === 'webp' ? ext : 'jpg'}`;
  const { error } = await supabase.storage.from('photos').upload(path, base64ToArrayBuffer(asset.base64), { contentType, upsert: false });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from('photos').getPublicUrl(path);
  return { url: data.publicUrl };
}
