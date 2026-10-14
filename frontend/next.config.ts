import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH ?? '',
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],

  // `lucide-react` adalah flat-export: tanpa ini Turbopack me-resolve seluruh
  // paket per ikon dan First Load JS membengkak (aturan 1.2 skill).
  experimental: { optimizePackageImports: ['lucide-react'] }
}

export default nextConfig
