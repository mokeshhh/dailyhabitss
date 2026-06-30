'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        <div className="nav-brand-icon">🏠</div>
        <div className="nav-brand-text">M<span>ee</span></div>
      </Link>
      <div className="nav-links">
        <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
          ✅ Today
        </Link>
        <Link href="/calendar" className={`nav-link ${pathname === '/calendar' ? 'active' : ''}`}>
          📅 Calendar
        </Link>
      </div>
    </nav>
  );
}
