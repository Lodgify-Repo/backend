import { join } from 'node:path';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_PUBLIC_PREFIX = '/uploads/avatars';
export const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');

export const AVATAR_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const AVATAR_ALLOWED_MIME_TYPES = new Set(Object.keys(AVATAR_MIME_EXTENSIONS));
