import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, X, ArrowRight } from 'lucide-react';
import logoImg from '../../assets/sanchari-logo.webp';
import { ImageWithFallback } from './common/ImageWithFallback';
import { COMPANY } from '../../config/company';
import { NAVIGATION } from '../../config/navigation';
import { Container } from './layout/Container';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100/80'
          : 'bg-transparent'
      }`}
    >
      <Container>
        <div className="flex items-center justify-between h-16 lg:h-[68px]">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <ImageWithFallback src={logoImg} alt="" width={36} height={36} fetchPriority="high" decoding="async" className="h-9 w-9 object-contain" />
            <span className="font-black text-[1.1rem] text-gray-900 tracking-[-0.02em]">{COMPANY.name}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAVIGATION.navbar.map((link) => {
              const isHash = link.href.startsWith('/#');
              if (isHash) {
                return (
                  <a
                    key={link.name}
                    href={isHome ? link.href.replace('/', '') : link.href}
                    className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-150"
                  >
                    {link.name}
                  </a>
                );
              } else {
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
                      link.href === '/investors'
                        ? 'text-amber-800 hover:text-amber-900 hover:bg-amber-50'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              }
            })}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href={isHome ? '#waitlist' : '/#waitlist'}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-dark active:scale-95 transition-all duration-150 shadow-lg shadow-brand/25"
            >
              Join Waitlist <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </Container>

      {/* Mobile menu */}
      <>
        {open && (
          <div
            key="mobile-menu"
            className="lg:hidden overflow-hidden bg-white border-b border-gray-100"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {NAVIGATION.navbar.map((link) => {
                const isHash = link.href.startsWith('/#');
                if (isHash) {
                  return (
                    <a
                      key={link.name}
                      href={isHome ? link.href.replace('/', '') : link.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center px-4 py-3 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                    >
                      {link.name}
                    </a>
                  );
                } else {
                  return (
                    <Link
                      key={link.name}
                      to={link.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center px-4 py-3 rounded-xl font-semibold transition-colors ${
                        link.href === '/investors'
                          ? 'text-amber-800 hover:bg-amber-50'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {link.name}
                    </Link>
                  );
                }
              })}
              <div className="pt-3 border-t border-gray-100 mt-3">
                <a
                  href={isHome ? '#waitlist' : '/#waitlist'}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark transition-colors"
                >
                  Join Waitlist <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}
      </>
    </header>
  );
}
