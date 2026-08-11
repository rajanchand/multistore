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

export interface HeroSlide {
  id: string;
  title: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  image?: string | null;
  mobileImage?: string | null;
}

const AUTOPLAY_MS = 5500;

const PLACEHOLDER_SLIDES: HeroSlide[] = [
  {
    id: 'placeholder-1',
    title: 'Your local shop, online',
    body: 'Pick a branch for live prices and stock — delivery or click & collect.',
    ctaLabel: 'Shop now',
    ctaUrl: '/products',
    image:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1800&q=80',
    mobileImage:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'placeholder-2',
    title: 'Everyday essentials nearby',
    body: 'Drinks, snacks, and household picks priced for the store you shop.',
    ctaLabel: 'Browse shop',
    ctaUrl: '/products',
    image:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=80',
    mobileImage:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'placeholder-3',
    title: 'Click & collect when ready',
    body: 'Order online, pick up from your nearest Neighbourhood Market.',
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
      className="relative overflow-hidden outline-none"
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

      <div className="relative min-h-[min(88vh,720px)] w-full md:min-h-[min(78vh,680px)]">
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
                  alt={slide.title}
                  className={[
                    'absolute inset-0 h-full w-full object-cover',
                    active && !reducedMotion ? 'nm-hero-media' : '',
                  ].join(' ')}
                  draggable={false}
                />
              </picture>

              {/* Light scrim for readability — keeps theme bright, no indigo wash */}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--nm-canvas)] via-[var(--nm-canvas)]/75 to-transparent md:bg-gradient-to-r md:from-[var(--nm-canvas)] md:via-[var(--nm-canvas)]/80 md:to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-[var(--nm-soft)]/30" />

              <div
                className={[
                  'relative mx-auto flex min-h-[min(88vh,720px)] max-w-6xl flex-col justify-end px-4 pb-16 pt-24 md:min-h-[min(78vh,680px)] md:justify-center md:px-6 md:pb-20',
                  active && !reducedMotion ? 'nm-hero-copy' : '',
                ].join(' ')}
              >
                <p className="font-display max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-[var(--nm-ink)] sm:text-5xl md:text-6xl lg:text-7xl">
                  Neighbourhood
                  <br />
                  <span className="text-[var(--nm-accent)]">Market</span>
                </p>
                <h1 className="mt-5 max-w-lg text-xl font-semibold leading-snug text-[var(--nm-ink)] sm:text-2xl md:text-3xl">
                  {slide.title}
                </h1>
                {slide.body ? (
                  <p className="mt-3 max-w-md text-base leading-relaxed text-[var(--nm-muted)] sm:text-lg">
                    {slide.body}
                  </p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={slide.ctaUrl ?? '/products'}
                    className="inline-flex h-12 min-w-[8.5rem] items-center justify-center rounded-xl bg-[var(--nm-accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--nm-accent-hover)]"
                  >
                    {slide.ctaLabel ?? 'Shop now'}
                  </Link>
                  <Link
                    href="/select-location"
                    className="inline-flex h-12 min-w-[8.5rem] items-center justify-center rounded-xl border border-[var(--nm-line)] bg-white/80 px-6 text-sm font-semibold text-[var(--nm-ink)] transition hover:bg-white"
                  >
                    Choose store
                  </Link>
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
            className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-[var(--nm-line)] bg-white/90 text-[var(--nm-ink)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nm-accent)] md:left-6 md:flex"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-[var(--nm-line)] bg-white/90 text-[var(--nm-ink)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nm-accent)] md:right-6 md:flex"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>

          <div
            className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 md:bottom-7"
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
                  'h-2 rounded-md transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nm-accent)]',
                  i === index
                    ? 'w-7 bg-[var(--nm-accent)]'
                    : 'w-2 bg-[var(--nm-ink)]/25 hover:bg-[var(--nm-ink)]/40',
                ].join(' ')}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
