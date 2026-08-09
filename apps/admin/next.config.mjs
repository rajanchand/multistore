/** @type {import('next').NextConfig} */
// Production may mount admin under a path (e.g. https://shop…/admin) via Nginx.
// Local/dev leaves ADMIN_BASE_PATH unset so the app stays on http://localhost:3001.
const adminBasePath = (process.env.ADMIN_BASE_PATH || '').replace(/\/$/, '');

const nextConfig = {
  output: 'standalone',
  ...(adminBasePath ? { basePath: adminBasePath } : {}),
  transpilePackages: ['@repo/ui', '@repo/types', '@repo/validation'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    NEXT_PUBLIC_ADMIN_BASE_PATH: adminBasePath,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
};

export default nextConfig;
