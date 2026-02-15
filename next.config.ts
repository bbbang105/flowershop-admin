import type { NextConfig } from "next";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다');
}

const supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const r2PublicUrl = process.env.R2_PUBLIC_URL;
const r2Hostname = r2PublicUrl ? new URL(r2PublicUrl).hostname : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/storage/v1/object/public/**',
      },
      ...(r2Hostname ? [{
        protocol: 'https' as const,
        hostname: r2Hostname,
        pathname: '/**',
      }] : []),
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
              `style-src 'self' 'unsafe-inline'`,
              `img-src 'self' data: blob: https://${supabaseHostname}${r2Hostname ? ` https://${r2Hostname}` : ''}`,
              `font-src 'self'`,
              `connect-src 'self' https://${supabaseHostname} wss://${supabaseHostname}${r2Hostname ? ` https://${r2Hostname}` : ''}`,
              `frame-ancestors 'none'`,
              "base-uri 'self'",
              "form-action 'self'",
              "worker-src 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
