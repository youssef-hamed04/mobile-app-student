import { evaluateCompletion } from '@/features/lessons/hooks';
import type { CompletionRule, WatchProgress } from '@/types/domain';

const progress = (over: Partial<WatchProgress> = {}): WatchProgress => ({
  lessonId: 'l1',
  positionSeconds: 0,
  durationSeconds: 600,
  percent: 0,
  completed: false,
  lastWatchedAt: '2026-08-17T00:00:00.000Z',
  ...over,
});

/**
 * The spec is explicit that opening a lesson must not complete it, and that
 * the rule comes from course configuration rather than the client. These
 * tests pin the seek-cheating case in particular: dragging the scrubber to
 * the end must not complete a contiguous-watch lesson.
 */
describe('evaluateCompletion', () => {
  const contiguous: CompletionRule = {
    type: 'WATCH_PERCENT',
    threshold: 90,
    requireContiguous: true,
  };

  it('does not complete a lesson that was merely opened', () => {
    expect(evaluateCompletion(contiguous, null, 0).complete).toBe(false);
    expect(evaluateCompletion(contiguous, progress(), 0).complete).toBe(false);
  });

  it('ignores seeked-past time when the rule requires contiguity', () => {
    // Position is at the very end, but only 30s were actually watched.
    const seeked = progress({ positionSeconds: 600, percent: 100 });
    expect(evaluateCompletion(contiguous, seeked, 30).complete).toBe(false);
    expect(evaluateCompletion(contiguous, seeked, 30).reachedPercent).toBe(5);
  });

  it('completes once enough contiguous time is watched', () => {
    const watched = progress({ positionSeconds: 550 });
    expect(evaluateCompletion(contiguous, watched, 545).complete).toBe(true);
  });

  it('uses raw percent when contiguity is not required', () => {
    const rule: CompletionRule = {
      type: 'WATCH_PERCENT',
      threshold: 80,
      requireContiguous: false,
    };
    const seeked = progress({ positionSeconds: 600, percent: 95 });
    expect(evaluateCompletion(rule, seeked, 0).complete).toBe(true);
  });

  it('honours an already-completed record regardless of the rule', () => {
    const done = progress({ completed: true });
    expect(evaluateCompletion(contiguous, done, 0).complete).toBe(true);
  });

  it('WATCH_FULL needs essentially the whole video', () => {
    const rule: CompletionRule = {
      type: 'WATCH_FULL',
      threshold: 100,
      requireContiguous: true,
    };
    expect(evaluateCompletion(rule, progress(), 540).complete).toBe(false);
    expect(evaluateCompletion(rule, progress(), 599).complete).toBe(true);
  });

  it('MANUAL never auto-completes from watch time', () => {
    const rule: CompletionRule = {
      type: 'MANUAL',
      threshold: 0,
      requireContiguous: false,
    };
    expect(evaluateCompletion(rule, progress(), 600).complete).toBe(false);
  });
});
