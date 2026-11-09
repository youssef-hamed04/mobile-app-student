import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Long-lesson continuity: the native player must survive a ticket rotation.
 *
 * `useVideoPlayer(source)` keys the player on its source and rebuilds it on
 * every change; the source changes on every rotation (and on a quality
 * change), so each rotation threw away the decoder and the buffer and restarted
 * from 0:00 paused. On the production TTL that was a stall every few minutes;
 * with a short TTL on a slow emulator the rebuild outlived the interval and
 * the lesson never played. These checks pin the shape of the fix - one player,
 * sources loaded into it in place, position and play state carried over -
 * because a component this native cannot be exercised under jest.
 */
const player = readFileSync(
  join(__dirname, '..', 'src', 'features', 'video', 'ProtectedVideoPlayer.tsx'),
  'utf8'
);

describe('ProtectedVideoPlayer keeps one native player across source swaps', () => {
  it('creates the player once, with no source, by hand so a rotation can replace it', () => {
    expect(player).toMatch(/createVideoPlayer\(null\)/);
    expect(player).not.toMatch(/useVideoPlayer\(/);
  });

  it('absorbs a ticket rotation in a primed standby player and falls back to the in-place replace', () => {
    // A rotation is the only source change with the same quality, reload and
    // DRM context; it must never be confused with a quality change or reload.
    expect(player).toMatch(/previousContext\.quality === swapContext\.quality/);
    expect(player).toMatch(/previousContext\.reloadKey === swapContext\.reloadKey/);
    const swap = player.slice(player.indexOf('const hotSwap = React.useCallback'));
    expect(swap).toMatch(/createVideoPlayer\(next\)/);
    expect(swap).toMatch(/standby\.muted = true/);
    expect(swap).toMatch(/audioMixingMode = 'mixWithOthers'/);
    expect(swap).toMatch(/standby\.bufferedPosition - old\.currentTime/);
    expect(swap).toMatch(/setPlayer\(standby\)/);
    expect(swap).toMatch(/old\.release\(\)/);
    // Behind a kill switch, so the in-place reload is one constant away.
    expect(player).toMatch(/PLAYER_ROTATION_HOT_SWAP &&\s*isRotation/);
    // Every failure path hands the source to the existing in-place loader.
    expect(swap).toMatch(/abandon\('timeout'\)/);
    expect(player).toMatch(/const cancel = hotSwap\(source, \(\) => \{[\s\S]*?\.replaceAsync\(source\)/);
  });

  it('loads every source - the first included - with replaceAsync on the same player', () => {
    expect(player).toMatch(/player\s*\.replaceAsync\(source\)/);
  });

  it('captures position and play state before a swap and restores them through one helper', () => {
    const swap = player.slice(player.indexOf('const isSwap ='));
    expect(swap).toMatch(/position > 0 \|\| play \? \{ position, play, since: Date\.now\(\) \} : null/);
    const apply = player.slice(player.indexOf('const applyRestore'));
    expect(apply).toMatch(/p\.currentTime = restore\.position;\s*if \(restore\.play\) p\.play\(\);/);
    const ready = player.slice(player.indexOf("if (status === 'readyToPlay')"));
    expect(ready).toMatch(/applyRestore\(\);/);
  });

  it('does not let a swap that lands mid-load read 0:00 as the position to return to', () => {
    expect(player).toMatch(/const position = carried \? carried\.position : lastPositionRef\.current/);
  });

  it('applies the restore from a timeUpdate or a poll once the player is ready, not only from the readyToPlay event', () => {
    // A rotation while the app was backgrounded produced no readyToPlay on
    // return, and a restore that waits for it alone freezes the UI.
    const tick = player.slice(player.indexOf("player.addListener('timeUpdate'"));
    expect(tick).toMatch(
      /if \(pendingRestoreRef\.current\) \{[\s\S]*?if \(player\.status === 'readyToPlay'\) applyRestore\(\);\s*return;\s*\}/
    );
    // A seek handed to a still-loading player is dropped (the lesson then really
    // restarts at 0:00), so neither path restores before `readyToPlay`.
    expect(player).toMatch(
      /setInterval\(\(\) => \{[\s\S]*?if \(player\.status === 'readyToPlay'\) applyRestore\(\);\s*\}, 1_000\)/
    );
  });

  it('ignores the old-source 0:00 that precedes the restore seek, briefly', () => {
    expect(player).toMatch(/currentTime < settle\.position - 1\.5\) return;/);
  });
});

describe('ticket request declares what this build can play', () => {
  it('sends the hls-aes128 capability, so older installed builds (which do not) keep getting Gumlet', () => {
    const api = readFileSync(join(__dirname, '..', 'src', 'features', 'video', 'api.ts'), 'utf8');
    expect(api).toMatch(/capabilities: \['hls-aes128'\]/);
  });
});
