import React from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import {
  RidePoolingIcon,
  ParcelPoolingIcon,
  TripPoolingIcon,
  SafetyShieldIcon,
  DriverVerificationIcon,
  VehicleVerificationIcon,
  SmartMatchingIcon,
} from './icons/SanchariIcons';
import { FEATURES } from '../../config/features';
import { COMPANY } from '../../config/company';
import { Container } from './layout/Container';
import { SectionHeading } from './common/SectionHeading';

const iconMap: Record<string, React.ReactNode> = {
  RidePoolingIcon: <RidePoolingIcon />,
  ParcelPoolingIcon: <ParcelPoolingIcon />,
  TripPoolingIcon: <TripPoolingIcon />,
  SafetyShieldIcon: <SafetyShieldIcon />,
  DriverVerificationIcon: <DriverVerificationIcon />,
  VehicleVerificationIcon: <VehicleVerificationIcon />,
  SmartMatchingIcon: <SmartMatchingIcon />,
};

export function ProductFeatures() {
  return (
    <section id="features" className="py-16 bg-white">
      <Container>

        <SectionHeading
          className="max-w-2xl mb-10"
          eyebrow="What we're building"
          title={<>Ride pooling first.<br />Two more modes after.</>}
          subtitle={`${COMPANY.name} starts with seats in cars that are already making the journey. Parcel and trip pooling reuse the same matching and payment layer, and both are clearly marked below as not yet released.`}
        />

        {/* Core modules, three across */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {FEATURES.modules.map((mod, i) => (
            <div
              key={i}
              className={`relative group bg-white rounded-3xl border ${mod.border || 'border-gray-100'} p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden`}
            >
              {/* Corner accent */}
              <div className={`absolute top-0 right-0 w-24 h-24 ${mod.highlight || 'bg-gray-100'} opacity-[0.06] rounded-bl-[4rem]`} />

              {/* Icon */}
              <div className={`w-12 h-12 rounded-2xl ${mod.bg || 'bg-gray-50'} ${mod.color || 'text-gray-900'} flex items-center justify-center mb-6`}>
                {iconMap[mod.iconName] || null}
              </div>

              {/* Phase badge */}
              <span className="inline-block text-[11px] font-black text-gray-700 uppercase tracking-widest mb-3">
                {mod.label}
              </span>

              <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">{mod.title}</h3>
              <p className="text-gray-600 leading-relaxed text-sm mb-6">{mod.desc}</p>

              <Link to={mod.href || '#'} className={`inline-flex items-center gap-1.5 text-sm font-bold ${mod.color || 'text-gray-900'} hover:opacity-80 transition-opacity`}>
                Learn more about {mod.title.toLowerCase()} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>

        {/* Differentiators, four across */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.differentiators.map((d, i) => (
            <div
              key={i}
              className="flex gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md hover:border-gray-200 transition-all duration-200"
            >
              <div className={`w-10 h-10 rounded-xl ${d.bg || 'bg-gray-50'} ${d.color || 'text-gray-900'} flex items-center justify-center shrink-0`}>
                {iconMap[d.iconName] || null}
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-1 text-sm">{d.title}</h4>
                <p className="text-gray-600 text-xs leading-relaxed">{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
