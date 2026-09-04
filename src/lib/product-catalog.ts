import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const PRODUCT_ASSETS_BUCKET = 'product-assets';
export const DEMO_PRODUCTS_COOKIE = 'demo_products';
export const DEMO_BRAND_PROFILE_COOKIE = 'demo_brand_profile';

export type Product = {
  id: string;
  user_id: string;
  brand_profile_id: string | null;
  brand_name: string;
  product_name: string;
  category: string | null;
  description: string | null;
  benefits: string[];
  ingredients: string[];
  price: string | null;
  offer: string | null;
  product_url: string | null;
  approved_claims: string[];
  prohibited_claims: string[];
  packshots: string[];
  primary_packshot: string | null;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
};

export type BrandProfile = {
  id: string;
  user_id: string;
  brand_name: string;
  website_url: string | null;
  description: string | null;
  target_audience: string | null;
  brand_voice: string | null;
  brand_values: string[];
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  approved_claims: string[];
  prohibited_claims: string[];
  created_at: string;
  updated_at: string;
};

const DEMO_PRODUCT: Product = {
  id: 'demo-aarohi-masala',
  user_id: 'demo-user',
  brand_profile_id: null,
  brand_name: 'Aarohi Pantry',
  product_name: 'Everyday Masala Blend',
  category: 'Spices',
  description: 'A balanced everyday spice blend for quick home cooking.',
  benefits: ['Consistent flavour for everyday meals', 'Easy to use'],
  ingredients: ['Coriander', 'Cumin', 'Turmeric', 'Black pepper'],
  price: '₹249',
  offer: null,
  product_url: null,
  approved_claims: ['Made with familiar kitchen spices'],
  prohibited_claims: ['Cures illness', 'Guaranteed weight loss'],
  packshots: ['/api/demo-product-packshot'],
  primary_packshot: '/api/demo-product-packshot',
  is_active: true,
  is_approved: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const PRODUCT_TEXT_FIELDS = [
  'brand_name',
  'product_name',
  'category',
  'description',
  'price',
  'offer',
  'product_url',
  'primary_packshot',
] as const;

const PRODUCT_ARRAY_FIELDS = [
  'benefits',
  'ingredients',
  'approved_claims',
  'prohibited_claims',
  'packshots',
] as const;

const BRAND_TEXT_FIELDS = [
  'brand_name',
  'website_url',
  'description',
  'target_audience',
  'brand_voice',
  'logo_url',
  'primary_color',
  'secondary_color',
] as const;

const BRAND_ARRAY_FIELDS = [
  'brand_values',
  'approved_claims',
  'prohibited_claims',
] as const;

function text(value: unknown, maxLength = 10_000): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function stringArray(value: unknown): string[] | null {
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 100);
  }
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 2_000))
    .filter(Boolean)
    .slice(0, 100);
}

export function productInput(
  body: unknown,
  partial = false
): Record<string, string | string[] | boolean | null> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const source = body as Record<string, unknown>;
  const result: Record<string, string | string[] | boolean | null> = {};

  for (const field of PRODUCT_TEXT_FIELDS) {
    if (field in source) result[field] = text(source[field]);
  }
  for (const field of PRODUCT_ARRAY_FIELDS) {
    if (field in source) {
      const value = stringArray(source[field]);
      if (value) result[field] = value;
    }
  }
  for (const field of ['is_active', 'is_approved'] as const) {
    if (typeof source[field] === 'boolean') result[field] = source[field];
  }
  if ('brand_profile_id' in source) result.brand_profile_id = text(source.brand_profile_id, 64);

  if (!partial) {
    result.brand_name ??= '';
    result.benefits ??= [];
    result.ingredients ??= [];
    result.approved_claims ??= [];
    result.prohibited_claims ??= [];
    result.packshots ??= [];
    result.is_active ??= true;
    result.is_approved ??= false;
  }

  const packshots = result.packshots;
  if (
    Array.isArray(packshots) &&
    typeof result.primary_packshot === 'string' &&
    !packshots.includes(result.primary_packshot)
  ) {
    result.packshots = [result.primary_packshot, ...packshots];
  }

  return result;
}

export function brandProfileInput(
  body: unknown
): Record<string, string | string[] | null> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const source = body as Record<string, unknown>;
  const result: Record<string, string | string[] | null> = {};

  for (const field of BRAND_TEXT_FIELDS) {
    if (field in source) result[field] = text(source[field]);
  }
  for (const field of BRAND_ARRAY_FIELDS) {
    if (field in source) {
      const value = stringArray(source[field]);
      if (value) result[field] = value;
    }
  }
  return result;
}

async function readCookie<T>(name: string, fallback: T): Promise<T> {
  const raw = (await cookies()).get(name)?.value;
  if (!raw) return fallback;
  try {
    return JSON.parse(decodeURIComponent(raw)) as T;
  } catch {
    return fallback;
  }
}

function setCookie<T>(response: NextResponse, name: string, value: T): NextResponse {
  response.cookies.set(name, encodeURIComponent(JSON.stringify(value)), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function readDemoProducts(): Promise<Product[]> {
  return readCookie<Product[]>(DEMO_PRODUCTS_COOKIE, [DEMO_PRODUCT]);
}

export function withDemoProducts(response: NextResponse, products: Product[]): NextResponse {
  return setCookie(response, DEMO_PRODUCTS_COOKIE, products);
}

export function readDemoBrandProfile(): Promise<BrandProfile | null> {
  return readCookie<BrandProfile | null>(DEMO_BRAND_PROFILE_COOKIE, null);
}

export function withDemoBrandProfile(
  response: NextResponse,
  profile: BrandProfile
): NextResponse {
  return setCookie(response, DEMO_BRAND_PROFILE_COOKIE, profile);
}
