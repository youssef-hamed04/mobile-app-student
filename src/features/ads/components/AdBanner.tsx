import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as React from 'react';
import {
  AccessibilityInfo,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/use-translation';
import { nativeIsRTL } from '@/i18n/direction';
import { createLogger } from '@/services/logger';
import type { Advertisement } from '@/types/domain';
import { cn } from '@/utils/cn';

import type { AdPlacement } from '../api';
import { useAdvertisements } from '../hooks';
import { resolveAdTarget } from '../target';

const log = createLogger('ads');

/** Screen gutter, matched to the rest of Home. */
const GUTTER = 16;
/** Used when the server does not declare the artwork's ratio. */
const DEFAULT_ASPECT_RATIO = 16 / 7;
const AUTOPLAY_MS = 5500;

export interface AdBannerProps {
  placement?: AdPlacement;
  /**
   * Advance automatically. Disabled outright when the OS reports a reduce
   * motion preference — auto-advancing carousels are a known vestibular
   * trigger, and one that students cannot opt out of from inside the app.
   */
  autoPlay?: boolean;
  className?: string;
}

/**
 * Home advertisement carousel.
 *
 * Three properties matter more than the visuals here:
 *
 *  1. It never blocks the screen. Its query is independent of the home feed,
 *     and every non-success state resolves to a fixed-height placeholder or
 *     nothing at all — the courses below it render regardless.
 *  2. It never reflows. One box is measured from the first banner's ratio and
 *     every slide is cropped into it, so a mixed-ratio campaign cannot push
 *     the content below it down after the images resolve.
 *  3. It fails quietly. A promotion that 404s is not an error a student needs
 *     to see, so the whole section collapses rather than rendering an error
 *     card in the middle of their dashboard.
 */
export function AdBanner({
  placement = 'HOME',
  autoPlay = true,
  className,
}: AdBannerProps) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();

  const query = useAdvertisements(placement);
  const ads = query.data ?? [];

  const pageWidth = Math.max(0, windowWidth - GUTTER * 2);
  // Reserving the box from the first banner keeps every slide the same height,
  // which is what stops a mixed-ratio campaign from reflowing the page.
  const aspectRatio = ads[0]?.aspectRatio || DEFAULT_ASPECT_RATIO;
  const height = pageWidth / aspectRatio;

  const [index, setIndex] = React.useState(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  // Autoplay must yield to the student the moment they touch the carousel.
  const interacted = React.useRef(false);

  React.useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const count = ads.length;

  /*
   * RTL paging.
   *
   * Under a mirrored layout the native row places the FIRST child against the
   * right edge, but scroll offset 0 is still the LEFT edge — so an untouched
   * carousel rests on the last slide. (Observed on device: a three-slide
   * carousel opened on "3 of 3".)
   *
   * Reversing the children puts the first slide back at offset 0, which means
   * the paging arithmetic, the autoplay target and the dot index stay
   * identical in both directions instead of every one of them needing its own
   * RTL branch. `nativeIsRTL` is the right source here rather than the
   * language store: what matters is how the native view tree is laid out.
   */
  const rtl = nativeIsRTL();
  const slides = rtl ? [...ads].reverse() : ads;

  React.useEffect(() => {
    if (!autoPlay || reduceMotion || count < 2 || pageWidth === 0) return;

    const timer = setInterval(() => {
      if (interacted.current) return;
      setIndex((current) => {
        const next = (current + 1) % count;
        scrollRef.current?.scrollTo({ x: next * pageWidth, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [autoPlay, reduceMotion, count, pageWidth]);

  // Clamped during render rather than corrected in an effect: if the list
  // shrinks between refetches, a stale index must never reach the dots even
  // for the one frame an effect-based reset would allow.
  const activeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth === 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setIndex(Math.min(Math.max(next, 0), Math.max(count - 1, 0)));
  };

  if (query.isLoading) {
    return (
      <View className={cn('px-4', className)}>
        <Skeleton height={height} rounded="lg" />
      </View>
    );
  }

  // Error and empty collapse to nothing: an absent promotion is a non-event
  // for the student, and a placeholder would only draw attention to it.
  if (query.isError || count === 0) return null;

  return (
    <View
      className={cn(className)}
      accessibilityRole="list"
      accessibilityLabel={t('ads.carouselLabel')}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: GUTTER }}
        onScrollBeginDrag={() => {
          interacted.current = true;
        }}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {slides.map((ad, i) => (
          <AdSlide
            key={ad.id}
            ad={ad}
            width={pageWidth}
            height={height}
            // The announced position stays the editorial order, not the
            // render order the mirroring forced on us.
            position={(rtl ? count - 1 - i : i) + 1}
            total={count}
          />
        ))}
      </ScrollView>

      {count > 1 ? <Dots count={count} active={activeIndex} /> : null}
    </View>
  );
}

function AdSlide({
  ad,
  width,
  height,
  position,
  total,
}: {
  ad: Advertisement;
  width: number;
  height: number;
  position: number;
  total: number;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const target = React.useMemo(() => resolveAdTarget(ad.target), [ad.target]);
  const hasCaption = !!(ad.title || ad.description || ad.ctaLabel);

  const onPress = () => {
    if (!target) return;
    if (target.kind === 'internal') {
      router.push(target.href as never);
      return;
    }
    // Already validated as http(s) by resolveAdTarget.
    void Linking.openURL(target.url).catch((e) =>
      log.warn('failed to open ad url', { id: ad.id, e: String(e) })
    );
  };

  const body = (
    <View
      // The plate treatment from the brand mark: hard outline, cropped art.
      className="overflow-hidden rounded-lg border-2 border-outline bg-surface-alt dark:border-border-strong"
      style={{ width, height }}
    >
      <Image
        source={{ uri: ad.imageUrl }}
        style={{ width: '100%', height: '100%' }}
        // `cover` is what lets a mixed-ratio campaign share one box without
        // letterboxing or distorting any single banner.
        contentFit="cover"
        transition={220}
        cachePolicy="memory-disk"
        recyclingKey={ad.id}
        accessibilityIgnoresInvertColors
      />

      {hasCaption ? (
        <View className="absolute inset-x-0 bottom-0 gap-1 bg-overlay/70 px-4 py-3">
          {ad.title ? (
            <Text variant="label" className="text-white" numberOfLines={1}>
              {ad.title}
            </Text>
          ) : null}

          {ad.description ? (
            <Text variant="caption" className="text-white/85" numberOfLines={2}>
              {ad.description}
            </Text>
          ) : null}

          {ad.ctaLabel && target ? (
            <View className="mt-1 self-start rounded-sm bg-highlight px-3 py-1">
              <Text variant="overline" tone="onHighlight" numberOfLines={1}>
                {ad.ctaLabel}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const label = [
    ad.title ?? t('ads.label'),
    ad.description ?? '',
    t('ads.slidePosition', { position, total }),
  ]
    .filter(Boolean)
    .join('. ');

  // An untargeted banner is presented as an image, not a button — announcing
  // a control that does nothing is worse than announcing no control.
  if (!target) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{ width }}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={ad.ctaLabel ?? undefined}
      onPress={onPress}
      style={{ width }}
      className="active:opacity-90"
    >
      {body}
    </Pressable>
  );
}

/**
 * Pagination indicators.
 *
 * Rendered in a plain `flex-row`, which the native layout mirrors under RTL —
 * so the dots track the swipe direction without any conditional code.
 */
function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="mt-3 flex-row items-center justify-center gap-1.5"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={cn(
            'h-1.5 rounded-full',
            i === active ? 'w-5 bg-highlight' : 'w-1.5 bg-border-strong'
          )}
        />
      ))}
    </View>
  );
}
