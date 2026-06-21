import React, { useState, useEffect } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel } from './CommonUI';
import { MapPin, Phone, Check, ShieldAlert, Library, Home, ChevronRight, Globe, User } from 'lucide-react';
import { COUNTRIES, validateCountryPhone } from '../utils/countries';

export const OnboardingView: React.FC = () => {
  const { user, completeOnboarding, navigateTo, campuses: CAMPUSES, locations: PRESET_LOCATIONS } = useMealDirect();

  // States
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [localPhone, setLocalPhone] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('');
  
  useEffect(() => {
    if (!selectedCampus && CAMPUSES.length > 0) {
      setSelectedCampus(CAMPUSES[0].id);
    }
  }, [CAMPUSES, selectedCampus]);

  const [selectedLocation, setSelectedLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Group locations by the actual zones returned by the backend (no hardcoded zone names)
  const filteredLocs = PRESET_LOCATIONS.filter(loc => loc.campusId === selectedCampus);
  const zoneNames = Array.from(new Set(filteredLocs.map(loc => loc.zone)));
  const zoneGroups = zoneNames.map(zoneName => ({
    zoneName,
    hostels: filteredLocs.filter(loc => loc.zone === zoneName && loc.type === 'Hostel'),
    depts: filteredLocs.filter(loc => loc.zone === zoneName && loc.type === 'Department')
  }));

  const handleFinishOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!validateCountryPhone(selectedCountry, localPhone)) {
      setErrorMessage(`Please provide a valid phone number for ${selectedCountry.name}. e.g. ${selectedCountry.example}`);
      return;
    }

    if (!selectedLocation) {
      setErrorMessage('Please select a valid preset hostel or department terminal desk for your drops.');
      return;
    }

    setIsSubmitting(true);

    const finalPhoneNumber = selectedCountry.code === 'OTHER'
      ? localPhone.trim()
      : `${selectedCountry.dialCode}${localPhone.trim().replace(/^0/, '')}`;

    setTimeout(() => {
      completeOnboarding(fullName.trim(), finalPhoneNumber, selectedCampus, selectedLocation);
      setIsSubmitting(false);
    }, 1200);
  };

  return (
    <AppShell activeTab="none">
      <div className="max-w-xl mx-auto py-4" id="onboarding_form">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black tracking-widest text-emerald-deep uppercase bg-emerald-deep/5 px-2.5 py-1 rounded">Step 2 of 2</span>
            <h2 className="font-display font-black text-2xl text-emerald-strong mt-1.5" id="onboarding_header">Completing Your Onboarding</h2>
            <p className="text-xs text-muted-grey">Tell us where to drop your hot meal deliveries.</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-xs text-danger font-semibold rounded-2xl flex items-start gap-2.5 animate-fade-in">
            <ShieldAlert className="w-5 h-5 text-danger shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleFinishOnboarding} className="flex flex-col gap-6">
          {/* Section 0: Full Name */}
          <GlassPanel className="p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <User className="w-5 h-5 text-emerald-deep" />
              <h3 className="font-display font-bold text-sm text-emerald-strong">Your Full Name</h3>
            </div>
            <p className="text-xs text-muted-grey mb-4 leading-relaxed">
              The name your courier and vendor will see for this order.
            </p>
            <input
              type="text"
              placeholder="e.g. Ada Okafor"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl text-sm focus:ring-2 focus:ring-emerald-deep focus:outline-none font-bold text-ink-deep"
              required
              id="onboarding_name_input"
            />
          </GlassPanel>

          {/* Section 1: Contact Phone */}
          <GlassPanel className="p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <Phone className="w-5 h-5 text-emerald-deep" />
              <h3 className="font-display font-bold text-sm text-emerald-strong">Emergency Contact Mobile</h3>
            </div>
            
            <p className="text-xs text-muted-grey mb-4 leading-relaxed">
              Required for SMS notifications when the courier rider arrives at your preset zone desk.
            </p>

            <div className="flex gap-2.5">
              <div className="w-1/3 shrink-0 relative">
                <select
                  value={selectedCountry.code}
                  onChange={(e) => {
                    const found = COUNTRIES.find(c => c.code === e.target.value);
                    if (found) {
                      setSelectedCountry(found);
                      setLocalPhone('');
                    }
                  }}
                  className="w-full px-3.5 py-3.5 bg-neutral-50/50 hover:bg-neutral-50 border border-emerald-deep/15 rounded-xl font-bold text-xs focus:ring-2 focus:ring-emerald-deep focus:outline-none appearance-none cursor-pointer h-full text-ink-deep"
                  id="onboarding_country_select"
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.dialCode}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-grey text-[9px]">
                  ▼
                </div>
              </div>

              <div className="flex-1 relative">
                <input
                  type="tel"
                  placeholder={selectedCountry.code === 'OTHER' ? '+234 803 123 4567' : selectedCountry.placeholder}
                  value={localPhone}
                  onChange={(e) => {
                    // Normalize and strip non-digit characters unless it's OTHER (which needs '+' for dialcode)
                    const allowedChars = selectedCountry.code === 'OTHER' ? /[^\d+]/g : /\D/g;
                    setLocalPhone(e.target.value.replace(allowedChars, ''));
                  }}
                  className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl font-mono text-sm focus:ring-2 focus:ring-emerald-deep focus:outline-none font-bold text-ink-deep"
                  required
                  id="onboarding_phone_input"
                />
              </div>
            </div>
            <span className="text-[10px] text-muted-grey mt-2 block font-medium">
              Format: {selectedCountry.example}
            </span>
          </GlassPanel>

          {/* Section 2: Choose Preset Dispatch Terminal */}
          <GlassPanel className="p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <MapPin className="w-5 h-5 text-emerald-deep" />
              <h3 className="font-display font-bold text-sm text-emerald-strong">Select Preset Dispatch Terminal</h3>
            </div>

            <p className="text-xs text-muted-grey mb-4 leading-relaxed">
              Meal Direct operates <strong>batch delivery</strong> to eliminate delays. Registering your most common hostel residency or department building wing ensures flawless timing.
            </p>

            {/* Campus Selector */}
            <div className="mb-6">
              <label className="text-[10px] font-bold text-muted-grey block mb-1.5 uppercase">Select Campus Unit</label>
              <select
                value={selectedCampus}
                onChange={(e) => {
                  setSelectedCampus(e.target.value);
                  setSelectedLocation('');
                }}
                className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl font-medium text-xs focus:ring-2 focus:ring-emerald-deep cursor-pointer focus:outline-none"
              >
                {CAMPUSES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Structured Card Grid Selection — grouped by real backend zones */}
            {filteredLocs.length === 0 ? (
              <p className="text-xs text-muted-grey italic py-4 text-center">
                No dispatch terminals available for this campus yet. Please check back shortly.
              </p>
            ) : (
              <div className="space-y-6">
                {zoneGroups.map(group => (
                  <div key={group.zoneName}>
                    <span className="text-[10px] font-bold tracking-wider text-emerald-strong bg-emerald-deep/5 px-2.5 py-1 rounded-full uppercase">
                      {group.zoneName} Dispatch Terminals
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                      {[...group.hostels, ...group.depts].map(loc => (
                        <button
                          type="button"
                          key={loc.id}
                          onClick={() => setSelectedLocation(loc.id)}
                          className={`flex items-center justify-between p-3.5 rounded-xl text-left border transition text-xs cursor-pointer ${
                            selectedLocation === loc.id
                              ? 'border-emerald-deep bg-emerald-deep/6 text-emerald-strong font-semibold'
                              : 'border-neutral-100 hover:border-emerald-deep/20 hover:bg-neutral-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {loc.type === 'Hostel'
                              ? <Home className="w-4 h-4 text-emerald-deep/80 shrink-0" />
                              : <Library className="w-4 h-4 text-emerald-deep/80 shrink-0" />}
                            <span className="truncate">{loc.name}</span>
                          </div>
                          {selectedLocation === loc.id && <Check className="w-4 h-4 text-emerald-deep shrink-0 ml-2" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>

          {/* Sticky Onboarding Actions */}
          <div className="mt-4 pb-8 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full sm:w-auto px-10 py-4.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                isSubmitting
                  ? 'bg-emerald-deep/20 text-emerald-strong/40 cursor-not-allowed'
                  : 'bg-emerald-deep hover:bg-emerald-strong text-white hover:scale-[1.01] active:scale-95 cursor-pointer shadow-lg shadow-emerald-deep/15'
              }`}
              id="onboarding_submit_btn"
            >
              <span>{isSubmitting ? 'Registering...' : 'Save & Enter Dashboard'}</span>
              {!isSubmitting && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
};
