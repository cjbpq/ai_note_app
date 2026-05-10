/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // 导出为纯静态资源
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
