/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is for `next build` / PM2. Leaving it on during
  // `next dev` mixes production webpack chunks into .next and surfaces as
  // MODULE_NOT_FOUND / "Cannot read properties of undefined (reading 'call')".
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@vapi-ai/web'],
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
