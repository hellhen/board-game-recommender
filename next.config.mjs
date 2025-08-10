/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['*'] }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cf.geekdo-images.com',
        port: '',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'boardgamegeek.com',
        port: '',
        pathname: '/images/**',
      }
    ]
  },
  // Optimize for production
  poweredByHeader: false,
  compress: true
};
export default nextConfig;
