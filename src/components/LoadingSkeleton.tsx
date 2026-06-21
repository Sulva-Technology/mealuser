import React from 'react';

/**
 * Standard continuous shimmer pulse container
 */
export const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`skeleton-pulse rounded ${className}`} />
  );
};

/**
 * LoadingSkeleton component collections
 */
export const LoadingSkeleton = {
  // 1. Text skeleton for headings, labels, etc.
  Text: ({ lines = 1, className = '', heightClass = 'h-3.5', widthClass = 'w-full' }: { lines?: number; className?: string; heightClass?: string; widthClass?: string }) => {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, idx) => (
          <SkeletonPulse
            key={idx}
            className={`${heightClass} ${
              lines > 1 && idx === lines - 1 ? 'w-2/3' : widthClass
            }`}
          />
        ))}
      </div>
    );
  },

  // 2. Vendor Card Skeleton matching the redesigned grid (HomeView style)
  Card: ({ count = 3 }: { count?: number }) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="glass-panel rounded-[24px] overflow-hidden p-0 flex flex-col justify-between border border-emerald-deep/12 shadow-sm"
          >
            <div>
              {/* Image box skeleton */}
              <div className="h-44 w-full relative bg-neutral-100/40 overflow-hidden border-b border-ink-deep/5">
                <SkeletonPulse className="w-full h-full rounded-none opacity-80" />
                <div className="absolute top-3 left-3 w-16 h-6 rounded-lg bg-white/80 backdrop-blur-md p-1 border border-white/60 shadow-xs">
                  <SkeletonPulse className="w-full h-full rounded" />
                </div>
              </div>

              {/* Body block */}
              <div className="p-5">
                {/* Certification badge skeleton */}
                <div className="w-16 h-4 rounded-md bg-[#16845B]/5 mb-2.5">
                  <SkeletonPulse className="w-full h-full" />
                </div>
                {/* Title */}
                <SkeletonPulse className="h-5 w-3/4 mb-3" />
                {/* Description */}
                <div className="space-y-2 mt-2">
                  <SkeletonPulse className="h-3 w-full" />
                  <SkeletonPulse className="h-3 w-5/6" />
                </div>
              </div>
            </div>

            {/* Bottom section */}
            <div className="p-5 pt-0">
              {/* Tags */}
              <div className="flex gap-1.5 mb-4">
                <SkeletonPulse className="h-5 w-12 rounded-md" />
                <SkeletonPulse className="h-5 w-14 rounded-md" />
              </div>
              {/* Button */}
              <SkeletonPulse className="h-10 w-full rounded-xl bg-ink-deep/60" />
            </div>
          </div>
        ))}
      </div>
    );
  },

  // 3. Wide List Card Skeleton matching horizontal layout (VendorsView style)
  ListCard: ({ count = 4 }: { count?: number }) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="glass-panel rounded-[24px] overflow-hidden p-0 flex flex-col justify-between border border-emerald-deep/12 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row h-full">
              {/* Left Image aspect */}
              <div className="h-44 sm:h-auto sm:w-44 shrink-0 relative bg-neutral-100/40 overflow-hidden border-r border-[#10231C]/5">
                <SkeletonPulse className="w-full h-full rounded-none opacity-80" />
                <div className="absolute top-3 left-3 w-12 h-6 rounded-lg bg-white/80 backdrop-blur-md p-1 border border-white/60 shadow-xs">
                  <SkeletonPulse className="w-full h-full rounded animate-pulse" />
                </div>
              </div>

              {/* Right Content aspect */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="w-16 h-4 bg-[#16845B]/5 rounded-md mb-2">
                    <SkeletonPulse className="w-full h-full" />
                  </div>
                  <SkeletonPulse className="h-5 w-1/2 mb-3" />
                  <div className="space-y-2 mt-1">
                    <SkeletonPulse className="h-3 w-full" />
                    <SkeletonPulse className="h-3 w-5/6" />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <SkeletonPulse className="h-5 w-14 rounded-md" />
                    <SkeletonPulse className="h-5 w-16 rounded-md" />
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-dashed border-ink-deep/10">
                    <SkeletonPulse className="h-3 w-24" />
                    <SkeletonPulse className="h-3.5 w-20 bg-emerald-deep/10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  },

  // 4. Menu & Category List Skeleton (VendorDetailView menu grid style)
  MenuList: ({ count = 4 }: { count?: number }) => {
    return (
      <div className="space-y-8">
        <div>
          <SkeletonPulse className="h-6 w-32 rounded mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: count }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#10231C]/5 p-4 flex gap-4 shadow-xs"
              >
                {/* Food Image */}
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-[#F7F8F4]">
                  <SkeletonPulse className="w-full h-full rounded-none" />
                </div>
                {/* Details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-bold text-sm">
                      <SkeletonPulse className="h-4 w-2/3 mb-1.5" />
                    </h4>
                    <div className="space-y-1">
                      <SkeletonPulse className="h-3 w-full" />
                      <SkeletonPulse className="h-3 w-4/5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-dashed border-[#10231C]/5">
                    <SkeletonPulse className="h-4 w-12" />
                    <SkeletonPulse className="h-8 w-20 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },

  // 5. Plain List row items (Orders, Notifications view style)
  ListRow: ({ count = 3 }: { count?: number }) => {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white border border-[#10231C]/5 rounded-2xl p-5 shadow-xs flex items-start gap-4"
          >
            {/* Round icon avatar skeleton */}
            <div className="w-10 h-10 rounded-full shrink-0 bg-[#F7F8F4] overflow-hidden">
              <SkeletonPulse className="w-full h-full" />
            </div>
            {/* Metadata lines */}
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <SkeletonPulse className="h-3.5 w-1/3" />
                <SkeletonPulse className="h-3 w-16" />
              </div>
              <SkeletonPulse className="h-3 w-5/6" />
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-dashed border-[#10231C]/5">
                <SkeletonPulse className="h-3 w-28" />
                <SkeletonPulse className="h-6 w-16 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  },

  // 6. Vendor Detail Page skeleton with heavy banner + catalog index
  Detail: () => {
    return (
      <div className="space-y-8">
        {/* Banner Skeleton */}
        <div className="bg-white rounded-3xl border border-[#10231C]/5 overflow-hidden shadow-xs">
          <div className="h-48 md:h-60 w-full relative bg-[#F7F8F4]">
            <SkeletonPulse className="w-full h-full rounded-none" />
            <div className="absolute bottom-5 left-5 right-5 space-y-2">
              <SkeletonPulse className="h-7 w-1/3" />
              <SkeletonPulse className="h-4.5 w-1/2" />
            </div>
          </div>
          <div className="p-4 px-6 bg-[#F7F8F4]/50 flex justify-between">
            <SkeletonPulse className="h-4 w-32" />
            <SkeletonPulse className="h-4 w-40" />
          </div>
        </div>

        {/* Category list loaders */}
        <LoadingSkeleton.MenuList count={2} />
      </div>
    );
  }
};
