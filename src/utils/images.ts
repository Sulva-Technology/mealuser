// Demo image fallback.
//
// Vendor logos and menu-item photos often arrive with a null/empty imageUrl from
// the backend (images are seeded separately). Rather than render a broken <img>,
// we substitute a deterministic demo picture:
//   - If VITE_DEMO_IMAGE_BASE is set, use <base>/image_<n>.jpg from the Supabase
//     public bucket (n derived from a stable hash of the seed, so the same vendor
//     /dish always gets the same picture).
//   - Otherwise, use a built-in branded SVG placeholder (no network request).
//
// Usage:
//   <img src={resolveImage(item.imageUrl, item.name)} onError={handleImageError(item.name)} ... />

import type React from 'react';

const DEMO_BASE = (import.meta.env.VITE_DEMO_IMAGE_BASE || '').replace(/\/+$/, '');
const DEMO_COUNT = Math.max(1, Number(import.meta.env.VITE_DEMO_IMAGE_COUNT) || 6);

// Stable, order-independent string hash (djb2).
function hashString(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Branded, dependency-free placeholder rendered as an inline SVG data URI.
function placeholderDataUri(seed: string): string {
  const palette = ['#10231C', '#0F3D2E', '#1B4D3E', '#14532D'];
  const bg = palette[hashString(seed) % palette.length];
  const letter = (seed.trim()[0] || 'M').toUpperCase();
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'>` +
    `<rect width='400' height='400' fill='${bg}'/>` +
    `<circle cx='200' cy='200' r='110' fill='#ffffff' opacity='0.06'/>` +
    `<text x='50%' y='50%' dy='.06em' text-anchor='middle' dominant-baseline='middle' ` +
    `font-family='Georgia, serif' font-size='180' font-weight='700' fill='#F2A516' opacity='0.92'>${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// The demo picture for a given seed (no real image available).
export function demoImage(seed: string): string {
  const key = seed || 'meal-direct';
  if (DEMO_BASE) {
    const n = (hashString(key) % DEMO_COUNT) + 1;
    return `${DEMO_BASE}/image_${n}.jpg`;
  }
  return placeholderDataUri(key);
}

// Resolve the src to use: the real URL if present, otherwise a demo picture.
export function resolveImage(url: string | null | undefined, seed: string): string {
  const trimmed = (url || '').trim();
  return trimmed ? trimmed : demoImage(seed);
}

// onError handler: swap to the demo picture once if the real image fails to load.
// Guards against an infinite error loop if the demo picture itself 404s.
export function handleImageError(seed: string) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallback === 'done') return;
    img.dataset.fallback = 'done';
    // If a bucket URL was configured but failed, fall back to the local placeholder.
    img.src = DEMO_BASE && !img.src.startsWith('data:') ? placeholderDataUri(seed) : demoImage(seed);
  };
}
