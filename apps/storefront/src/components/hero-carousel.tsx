'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@repo/ui';

export interface HeroSlide {
  id: string;
  title: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  image?: string | null;
  mobileImage?: string | null;
}

const AUTOPLAY_MS = 5000;

const PLACEHOLDER_SLIDES: HeroSlide[] = [
  {
    id: 'placeholder-1',
    title: 'Your local shop, online',
    body: 'Pick your branch for accurate prices and stock. Delivery or click & collect from stores across the UK.',
    ctaLabel: 'Shop now',
    ctaUrl: '/products',
    image:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1800&q=80',
    mobileImage:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'placeholder-2',
    title: 'Fresh deals at your branch',
    body: 'Energy drinks, snacks, and everyday essentials — priced for the store you shop.',
    ctaLabel: 'Browse categories',
    ctaUrl: '/categories/energy-drinks',
    image:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=80',
    mobileImage:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'placeholder-3',
    title: 'Click & collect made easy',
    body: 'Order online and pick up from your nearest Neighbourhood Market when it suits you.',
    ctaLabel: 'View products',
    ctaUrl: '/products',
    image:
      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1800&q=80',
    mobileImage:
      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=900&q=80',
  },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const items = slides.length > 0 ? slides : PLACEHOLDER_SLIDES;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const regionId = useId();
  const liveRef = useRef<HTMLDivElement>(null);

  const count = items.length;
  const current = items[index] ?? items[0]!;

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    if (reducedMotion || paused || count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, paused, count]);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.textContent = `Slide ${index + 1} of ${count}: ${current.title}`;
    }
  }, [index, count, current.title]);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(count - 1);
    }
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby={`${regionId}-label`}
      className="relative overflow-hidden bg-slate-900 text-white outline-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <h2 id={`${regionId}-label`} className="sr-only">
        Featured promotions
      </h2>
      <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <div className="relative min-h-[70vh] w-full">
        {items.map((slide, i) => {
          const active = i === index;
          const desktopSrc = slide.image ?? PLACEHOLDER_SLIDES[i % PLACEHOLDER_SLIDES.length]!.image!;
          const mobileSrc = slide.mobileImage || desktopSrc;

          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!active}
              className={[
                'absolute inset-0 transition-opacity duration-700 ease-out',
                active ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                reducedMotion ? '!duration-0' : '',
              ].join(' ')}
            >
              <picture>
                <source media="(max-width: 767px)" srcSet={mobileSrc} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={desktopSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/55 to-indigo-950/35" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]" />

              <div className="relative mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-4 py-20 md:px-6">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-100">
                  Neighbourhood Market
                </p>
                <h1 className="mt-4 max-w-2xl font-[Fraunces] text-5xl font-bold leading-tight md:text-6xl">
                  {slide.title}
                </h1>
                {slide.body ? (
                  <p className="mt-4 max-w-xl text-lg text-indigo-50/90">{slide.body}</p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="bg-white text-indigo-700 hover:bg-indigo-50">
                    <Link href="/products">Shop now</Link>
                  </Button>
                  {(slide.ctaUrl || slide.ctaLabel) && (
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="border-white/40 bg-transparent text-white hover:bg-white/10"
                    >
                      <Link href={slide.ctaUrl ?? '/products'}>
                        {slide.ctaLabel ?? 'Learn more'}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-slate-950/40 text-white backdrop-blur-sm transition hover:bg-slate-950/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:left-6"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-slate-950/40 text-white backdrop-blur-sm transition hover:bg-slate-950/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:right-6"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>

          <div
            className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2"
            role="tablist"
            aria-label="Choose slide"
          >
            {items.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}: ${slide.title}`}
                onClick={() => goTo(i)}
                className={[
                  'h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                  i === index ? 'w-8 bg-white' : 'w-2.5 bg-white/45 hover:bg-white/70',
                ].join(' ')}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
