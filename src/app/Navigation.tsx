'use client';

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/test", label: "Test" },
    { href: "/auswertung", label: "KI Puls" },
    { href: "/herausforderungen", label: "Herausforderungen" },
  ];

  // Blendet die Navigation auf der Test-Seite aus
  if (pathname.startsWith('/test')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0">
              <Link href="/" className="text-xl font-bold text-blue-700 hover:text-blue-800">edu-KI&nbsp;Puls</Link>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navLinks.map((link) => (
                   <Link key={link.href} href={link.href} className="text-neutral-600 hover:bg-primary-500 hover:text-white px-3 py-2 rounded-md text-sm font-medium">{link.label}</Link>
                ))}
              </div>
            </div>
            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="inline-flex items-center justify-center p-2 rounded-md text-neutral-600 hover:text-white hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                <span className="sr-only">Hauptmenü öffnen</span>
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu Panel */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
               {navLinks.map((link) => (
                   <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)} className="text-neutral-600 hover:bg-primary-500 hover:text-white block px-3 py-2 rounded-md text-base font-medium">{link.label}</Link>
                ))}
            </div>
          </div>
        )}
    </header>
  );
} 