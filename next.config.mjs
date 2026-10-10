/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Playwright must run from node_modules — do not bundle into API routes
    serverComponentsExternalPackages: [
      'playwright',
      'playwright-core',
      'tsx',
      // Exports its binary path from __dirname — must not be bundled
      'ffmpeg-static',
    ],
  },
};

export default nextConfig;
