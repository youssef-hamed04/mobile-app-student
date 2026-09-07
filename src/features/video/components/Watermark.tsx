import * as React from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { zIndex } from '@/theme/tokens';
import type { WatermarkPayload } from '@/types/domain';

export interface WatermarkProps {
  payload: WatermarkPayload;
  /** Container size; the watermark repositions itself inside these bounds. */
  width: number;
  height: number;
  /** Pause repositioning while the video is paused (saves a timer). */
  active?: boolean;
}

/**
 * Dynamic, moving, per-session watermark.
 *
 * Design decisions, all of them security-motivated:
 *
 *  • **Server-issued content.** The name, the account id and an opaque signed
 *    `sessionTag` all come from the playback ticket. The client cannot choose
 *    what it displays, so patching the app to show someone else's name does
 *    not change what the backend recorded for the session.
 *
 *  • **Nine-position lattice, non-repeating order.** Rather than cycling four
 *    corners (trivially croppable), the mark walks a 3×3 grid in a shuffled
 *    order that never lands twice in the same cell consecutively. Cropping
 *    any single region therefore loses part of the frame in most cycles.
 *
 *  • **Two-layer redundancy.** A prominent moving mark plus a faint, static,
 *    tiled background layer. Removing the moving mark with a mask still
 *    leaves the tiled layer; removing the tiled layer requires re-encoding
 *    that visibly degrades the whole frame.
 *
 *  • **Time-coded second line.** The secondary line includes the wall-clock
 *    time, so a leaked recording can be pinned to a session window rather
 *    than just an account.
 *
 *  • **pointerEvents none, above every control.** Rendered at
 *    zIndex.watermark, so no player chrome can ever cover it, and it can't
 *    swallow taps meant for the controls.
 */

/** 3×3 lattice as fractions of the container, inset from the edges. */
const CELLS: { x: number; y: number }[] = [
  { x: 0.08, y: 0.1 },
  { x: 0.5, y: 0.08 },
  { x: 0.88, y: 0.12 },
  { x: 0.06, y: 0.48 },
  { x: 0.52, y: 0.5 },
  { x: 0.9, y: 0.46 },
  { x: 0.1, y: 0.86 },
  { x: 0.48, y: 0.9 },
  { x: 0.86, y: 0.84 },
];

function nextIndex(current: number): number {
  let next = current;
  // Never repeat the previous cell, and prefer a cell that isn't adjacent —
  // a small jump reads as a glitch and is easy to crop around.
  let guard = 0;
  while ((next === current || Math.abs(next - current) < 2) && guard < 12) {
    next = Math.floor(Math.random() * CELLS.length);
    guard += 1;
  }
  return next;
}

export function Watermark({ payload, width, height, active = true }: WatermarkProps) {
  const [cell, setCell] = React.useState(() => Math.floor(Math.random() * CELLS.length));
  const [clock, setClock] = React.useState(() => new Date());

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(payload.opacity);

  // Reposition on the server-configured interval.
  React.useEffect(() => {
    if (!active) return;

    const intervalMs = Math.max(5, payload.moveIntervalSeconds) * 1000;
    const id = setInterval(() => {
      setCell((c) => nextIndex(c));
      setClock(new Date());
    }, intervalMs);

    return () => clearInterval(id);
  }, [active, payload.moveIntervalSeconds]);

  // Animate to the new cell. A slow fade-out/fade-in makes the jump feel
  // intentional rather than like a rendering bug, without ever fully hiding
  // the mark (minimum opacity stays above zero).
  React.useEffect(() => {
    const target = CELLS[cell] ?? CELLS[4]!;
    const duration = 900;

    opacity.value = withTiming(payload.opacity * 0.45, { duration: duration / 2 });

    x.value = withTiming(target.x * width, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    });
    y.value = withTiming(target.y * height, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    });

    const id = setTimeout(() => {
      opacity.value = withTiming(payload.opacity, { duration: duration / 2 });
    }, duration / 2);

    return () => clearTimeout(id);
  }, [cell, width, height, payload.opacity, x, y, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      // Keep the mark anchored by its own centre-ish point.
      { translateX: -60 },
    ],
    opacity: opacity.value,
  }));

  const timeLabel = `${clock.getHours().toString().padStart(2, '0')}:${clock
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: zIndex.watermark }}
    >
      {/* Layer 1 — faint static tiling. Survives cropping of the moving mark. */}
      <TiledLayer payload={payload} width={width} height={height} />

      {/* Layer 2 — prominent moving mark. */}
      <Animated.View style={[{ position: 'absolute', maxWidth: 220 }, style]}>
        <Text
          variant="caption"
          className="text-white"
          style={{
            textShadowColor: 'rgba(0,0,0,0.85)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
          numberOfLines={1}
        >
          {payload.primary}
        </Text>
        <Text
          variant="caption"
          className="text-white"
          forceLatin
          style={{
            fontSize: 10,
            textShadowColor: 'rgba(0,0,0,0.85)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
          numberOfLines={1}
        >
          {payload.secondary} · {timeLabel}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * Static diagonal tiling at very low opacity. Readable enough to identify an
 * account in a re-encoded capture, faint enough not to distract while
 * studying.
 */
function TiledLayer({
  payload,
  width,
  height,
}: {
  payload: WatermarkPayload;
  width: number;
  height: number;
}) {
  const { fontScale } = useWindowDimensions();

  const cols = Math.max(2, Math.ceil(width / 190));
  const rows = Math.max(2, Math.ceil(height / 130));

  const tiles = React.useMemo(() => {
    const out: { key: string; left: number; top: number }[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        out.push({
          key: `${r}-${c}`,
          // Offset every other row so the pattern isn't a clean grid that
          // could be masked with a single repeating overlay.
          left: c * 190 + (r % 2 === 0 ? 0 : 95) - 40,
          top: r * 130 + 20,
        });
      }
    }
    return out;
  }, [rows, cols]);

  return (
    <View pointerEvents="none" className="absolute inset-0">
      {tiles.map((tile) => (
        <View
          key={tile.key}
          style={{
            position: 'absolute',
            left: tile.left,
            top: tile.top,
            transform: [{ rotate: '-24deg' }],
            opacity: 0.075,
          }}
        >
          <Text
            className="text-white"
            forceLatin
            style={{ fontSize: 11 / Math.max(1, fontScale) }}
            numberOfLines={1}
          >
            {payload.secondary} · {payload.sessionTag.slice(0, 10)}
          </Text>
        </View>
      ))}
    </View>
  );
}
