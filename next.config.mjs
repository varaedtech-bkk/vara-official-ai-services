/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces .next/standalone so the app can run on a VPS behind Nginx via PM2
  // without needing node_modules on the server.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // getUserMedia (microphone) must be allowed for this origin.
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
