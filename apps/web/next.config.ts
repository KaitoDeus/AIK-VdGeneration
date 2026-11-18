import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.NEXT_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
};

export default nextConfig;
