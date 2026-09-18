import { Hero } from '../components/Hero';
import { ProductFeatures } from '../components/ProductFeatures';
import { WomenSafety } from '../components/WomenSafety';
import { HowItWorks } from '../components/HowItWorks';
import { Faq } from '../components/Faq';
import { Waitlist } from '../components/Waitlist';

export function LandingPage() {
  return (
    <>
      <Hero />
      <ProductFeatures />
      <WomenSafety />
      <HowItWorks />
      <Faq />
      <Waitlist />
    </>
  );
}
