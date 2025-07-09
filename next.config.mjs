/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Configuration pour les gros fichiers
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // Augmenter les limites pour les uploads
  serverRuntimeConfig: {
    // Timeout de 60 minutes pour les très gros fichiers
    maxDuration: 3600,
  },
  // Configuration pour les API routes
  api: {
    bodyParser: {
      sizeLimit: false, // Pas de limite de taille
    },
    responseLimit: false,
  },
}

export default nextConfig
