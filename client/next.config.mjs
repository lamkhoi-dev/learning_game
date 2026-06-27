/** @type {import('next').NextConfig} */
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000'

// CHIA SẺ QUA NGROK: luôn mở `ngrok http 4000` (KHÔNG phải 3000).
// Cổng 4000 (backend) xử lý WebSocket native + proxy giao diện. Một tunnel lo hết.
//
// Rewrite /api dưới đây chỉ để TIỆN khi dev mở thẳng localhost:3000.
// KHÔNG rewrite /socket.io vì Next dev không relay được WebSocket (gây lỗi 500).
// Khi mở localhost:3000, socket tự nối thẳng tới localhost:4000 (xem lib/socket.ts).
const nextConfig = {
  eslint: { ignoreDuringBuilds: true }, // không chặn build production vì lỗi lint vặt
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND}/api/:path*` },
    ]
  },
}

export default nextConfig
