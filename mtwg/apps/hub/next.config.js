/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mtwg/db', '@mtwg/types', '@mtwg/sdk'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'mountaintwìggames.com' },
    ],
  },
}

module.exports = nextConfig
