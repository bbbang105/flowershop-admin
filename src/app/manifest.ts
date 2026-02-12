import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '헤이즐 어드민 - 꽃집 관리 시스템',
    short_name: '헤이즐',
    description: '매출, 지출, 고객, 예약을 한곳에서 관리하세요',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#FAFAF8',
    theme_color: '#E5614E',
    categories: ['productivity', 'business'],
    icons: [
      {
        src: '/icons/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: '매출 등록',
        short_name: '매출',
        url: '/sales?action=create',
        icons: [{ src: '/icons/icon-192x192.svg', sizes: '192x192' }],
      },
      {
        name: '예약 캘린더',
        short_name: '예약',
        url: '/calendar',
        icons: [{ src: '/icons/icon-192x192.svg', sizes: '192x192' }],
      },
    ],
  };
}
