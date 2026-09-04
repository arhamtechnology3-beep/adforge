/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Playwright must run from node_modules — do not bundle into API routes
    serverComponentsExternalPackages: [
      'playwright',
      'playwright-core',
      'tsx',
    ],
  },
};

export default nextConfig;
