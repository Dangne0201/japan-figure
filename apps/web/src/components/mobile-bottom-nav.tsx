'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Trang chủ', icon: '⌂' },
  { href: '/collections', label: 'Khám phá', icon: '▦' },
  { href: '/chat', label: 'Tư vấn', icon: '✧' },
  { href: '/account', label: 'Tài khoản', icon: '♙' },
  { href: '/cart', label: 'Giỏ hàng', icon: '♡' },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav sm:hidden" aria-label="Điều hướng nhanh">
      {items.map(({ href, label, icon }) => {
        const active =
          href === '/'
            ? pathname === '/'
            : href === '/collections'
              ? pathname === href || pathname.startsWith('/products')
              : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className="mobile-bottom-nav__link"
            href={href}
            key={href}
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {icon}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
