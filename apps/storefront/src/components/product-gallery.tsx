'use client';

import Image from 'next/image';
import { useState } from 'react';
import { X } from 'lucide-react';

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const fallback = 'https://placehold.co/800x800/e7f4ef/0f7a63?text=Neighbourhood';
  const list = images.length > 0 ? images : [fallback];
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const src = list[active] ?? list[0] ?? fallback;
  const remote = src.startsWith('http');

  return (
    <div>
      <button
        type="button"
        className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--nm-line)]"
        onClick={() => setLightbox(true)}
        aria-label="Open image lightbox"
      >
        {remote ? (
          <Image
            src={src}
            alt={alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-contain p-6"
            unoptimized={src.includes('placehold.co') || src.startsWith('data:')}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="h-full w-full object-contain p-6" />
        )}
      </button>

      {list.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {list.map((thumb, i) => (
            <button
              key={`${thumb}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${
                i === active ? 'border-[var(--nm-accent)]' : 'border-[var(--nm-line)] opacity-80'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
            aria-label="Close"
            onClick={() => setLightbox(false)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
