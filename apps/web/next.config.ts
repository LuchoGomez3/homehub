/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@homehub/shared', '@homehub/ui'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@homehub/ui'],
  },
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/socket.io/:path*` },
    ];
  },
};

module.exports = nextConfig;