export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  placeholder: string;
  example: string;
  minLength: number;
  maxLength: number;
}

export const COUNTRIES: Country[] = [
  {
    name: 'Nigeria',
    code: 'NG',
    dialCode: '+234',
    flag: '🇳🇬',
    placeholder: '803 123 4567',
    example: '0803 123 4567 or 803 123 4567',
    minLength: 7,
    maxLength: 11
  },
  {
    name: 'Ghana',
    code: 'GH',
    dialCode: '+233',
    flag: '🇬🇭',
    placeholder: '20 123 4567',
    example: '20 123 4567',
    minLength: 8,
    maxLength: 10
  },
  {
    name: 'Kenya',
    code: 'KE',
    dialCode: '+254',
    flag: '🇰🇪',
    placeholder: '712 345 678',
    example: '712 345 678',
    minLength: 9,
    maxLength: 10
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    dialCode: '+44',
    flag: '🇬🇧',
    placeholder: '7123 456789',
    example: '7123 456789',
    minLength: 10,
    maxLength: 11
  },
  {
    name: 'United States',
    code: 'US',
    dialCode: '+1',
    flag: '🇺🇸',
    placeholder: '201 555 0123',
    example: '201 555 0123',
    minLength: 10,
    maxLength: 10
  },
  {
    name: 'Canada',
    code: 'CA',
    dialCode: '+1',
    flag: '🇨🇦',
    placeholder: '201 555 0123',
    example: '201 555 0123',
    minLength: 10,
    maxLength: 10
  },
  {
    name: 'Other',
    code: 'OTHER',
    dialCode: '+',
    flag: '🌐',
    placeholder: 'Enter full number with dial code',
    example: '+1234567890',
    minLength: 8,
    maxLength: 15
  }
];

/**
 * Normalizes and parses a stored phone number to locate its corresponding country and local number.
 * Defaults to Nigeria (+234).
 */
export const parseStoredPhone = (phoneStr: string): { country: Country; localNumber: string } => {
  const clean = (phoneStr || '').trim();
  
  if (!clean) {
    return { country: COUNTRIES[0], localNumber: '' };
  }

  // Check if starts with a known dialCode
  for (const country of COUNTRIES) {
    if (country.code !== 'OTHER' && clean.startsWith(country.dialCode)) {
      let local = clean.substring(country.dialCode.length);
      // If local number was saved with a leading zero (e.g. +234080...), clean it up unless it's other
      if (local.startsWith('0') && country.code === 'NG') {
        local = local.substring(1);
      }
      return { country, localNumber: local };
    }
  }

  // If it starts with '0' and no dial code is upfront, it is likely Nigeria (default)
  if (clean.startsWith('0') && clean.length === 11) {
    return { country: COUNTRIES[0], localNumber: clean.substring(1) };
  }

  // Fallback to Other
  if (clean.startsWith('+')) {
    return { country: COUNTRIES.find(c => c.code === 'OTHER')!, localNumber: clean };
  }

  return { country: COUNTRIES[0], localNumber: clean };
};

/**
 * Validates a local number for a given country
 */
export const validateCountryPhone = (country: Country, local: string): boolean => {
  const cleanLocal = local.replace(/\s+/g, '');
  if (!cleanLocal) return false;

  if (country.code === 'OTHER') {
    // Other should have a "+" and at least 8 digits
    return cleanLocal.startsWith('+') && cleanLocal.length >= 8 && cleanLocal.length <= 16;
  }

  // Strip leading 0 if user inputted it (common in local numbers)
  let normalized = cleanLocal;
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }

  // Special Check for Nigeria local number patterns (should be 10 digits after removing leading 0)
  if (country.code === 'NG') {
    return normalized.length === 10 && /^[789][01]\d{8}$/.test(normalized);
  }

  return normalized.length >= country.minLength - 1 && normalized.length <= country.maxLength;
};
