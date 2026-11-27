/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // Necessário para imagens funcionarem sem servidor Node.js no Capacitor
  },
}

export default nextConfig