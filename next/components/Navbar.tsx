"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Transactions', href: '/transactions', icon: 'bi-list-ul', route: 'transaction' },
    { name: 'Abonnements', href: '/subscriptions', icon: 'bi-arrow-repeat', route: 'subscription' },
    { name: 'Comptes', href: '/accounts', icon: 'bi-bank', route: 'account' },
    { name: 'Catégories', href: '/categories', icon: 'bi-tags', route: 'category' },
    { name: 'Statistiques', href: '/statistics', icon: 'bi-graph-up-arrow', route: 'statistics' },
  ];

  return (
    <nav className="navbar navbar-expand navbar-dark bg-dark mb-4">
      <div className="container">
        <Link className="navbar-brand" href="/">
          <i className="bi bi-wallet2 me-2"></i>Budget
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="nav">
          <ul className="navbar-nav me-auto">
            {navItems.map((item) => (
              <li className="nav-item" key={item.href}>
                <Link
                  className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
                  href={item.href}
                >
                  <i className={`bi ${item.icon} me-1`}></i>{item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
