/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow server-side fetches to the ExpenseFlow API
  experimental: {},

  // Expose public env vars to the browser (used in CTA links)
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://client-six-inky-54.vercel.app',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://server-one-dusky-56.vercel.app',
  },
};

module.exports = nextConfig;
