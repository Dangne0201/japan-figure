import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegistration from '../components/pwa-registration';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:8081'),
  title: 'Japan Figure | Mô hình anime',
  description:
    'Japan Figure — cửa hàng mô phỏng figure anime với phong cách tinh tế, thân thiện và pastel.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fffaf6',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <a className="skip-link" href="#main-content">
          Bỏ qua đến nội dung chính
        </a>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
