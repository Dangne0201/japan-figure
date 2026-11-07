import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Japan Figure',
    short_name: 'Japan Figure',
    description: 'Cửa hàng mô phỏng figure anime phục vụ học tập.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffaf6',
    theme_color: '#fffaf6',
    icons: [
      {
        src: '/icons/figure-flower.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
