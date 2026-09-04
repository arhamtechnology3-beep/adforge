/** Fallback packshots when website scrape returns no images (common in dev / blocked hosts). */
const DEMO_PRODUCT_IMAGES: Record<string, string[]> = {
  farmdidi: [
    'https://www.farmdidi.com/cdn/shop/files/FD_Mango_Pickle_400g_1.jpg?v=1709280000',
    'https://www.farmdidi.com/cdn/shop/files/FD_Lemon_Pickle_400g_1.jpg?v=1709280000',
    'https://www.farmdidi.com/cdn/shop/files/FD_Garlic_Pickle_400g_1.jpg?v=1709280000',
  ],
};

export function demoProductImagesForUrl(websiteUrl: string): string[] {
  try {
    const host = new URL(websiteUrl).hostname.replace(/^www\./, '').toLowerCase();
    const key = host.split('.')[0];
    return DEMO_PRODUCT_IMAGES[key] || DEMO_PRODUCT_IMAGES[host] || [];
  } catch {
    return [];
  }
}
