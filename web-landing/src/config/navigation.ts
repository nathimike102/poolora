export interface NavLink {
  name: string;
  href: string;
  isExternal?: boolean;
}

export interface NavigationConfig {
  navbar: NavLink[];
  footer: {
    product: NavLink[];
    company: NavLink[];
    legal: NavLink[];
  };
}

export const NAVIGATION: NavigationConfig = {
  navbar: [
    { name: 'Features', href: '/#features' },
    { name: 'Safety', href: '/#safety' },
    { name: 'How It Works', href: '/#how-it-works' },
    { name: 'FAQ', href: '/#faq' },
    { name: 'Contact', href: '/#contact' },
    { name: 'Investors', href: '/investors' },
  ],
  footer: {
    product: [
      { name: 'Car Pooling', href: '/features/ride-pooling' },
      { name: 'Parcel Pooling', href: '/features/parcel-pooling' },
      { name: 'Trip Pooling', href: '/features/trip-pooling' },
    ],
    company: [
      { name: 'About Us', href: '/about' },
      { name: 'Investors', href: '/investors' },
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
  },
};
