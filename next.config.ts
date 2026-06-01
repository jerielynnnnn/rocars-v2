/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'example.com', // Remove this - it's just a placeholder
      'your-supabase-project.supabase.co', // Add your Supabase storage domain
      'lh3.googleusercontent.com', // For Google images if needed
      'platform-lookaside.fbsbx.com', // For Facebook images if needed
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig