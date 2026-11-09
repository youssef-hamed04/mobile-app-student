import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { buildPdfHtml, isPdfUrl } from '@/features/library/pdf-html';
import {
  PDF_WATERMARK_MAX_PAGE_FRACTION,
  PDF_WATERMARK_OPACITY,
  PDF_WATERMARK_SCRIPT,
  identityWatermarkText,
} from '@/features/library/pdf-watermark';

/**
 * Mobile port of student-web's PDF watermark (src/lib/pdf-watermark.ts +
 * src/components/protection/Watermark.tsx). These mirror the web's
 * pdf-watermark.test.ts, and they evaluate the SAME script string the reader
 * page runs, so what passes here is what draws on the phone.
 */

type Placement = { x: number; y: number; width: number; height: number } | null;
type Wm = {
  placement: (pw: number, ph: number, iw: number, ih: number) => Placement;
  burnImage: (ctx: unknown, pw: number, ph: number, image: unknown) => void;
  burnText: (ctx: unknown, pw: number, ph: number, text: string, scale: number) => void;
};
// eslint-disable-next-line no-new-func
const wm = new Function(`${PDF_WATERMARK_SCRIPT}; return __swWatermark;`)() as Wm;

const IMAGE = { naturalWidth: 1824, naturalHeight: 2003 };

function fakeContext(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(
    {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      drawImage: (...args: unknown[]) => calls.push(`drawImage:${args.slice(1).join(',')}`),
      translate: () => calls.push('translate'),
      rotate: (a: number) => calls.push(`rotate:${a}`),
      fillText: () => calls.push('fillText'),
      measureText: (t: string) => ({ width: t.length * 10 }),
      ...overrides,
    } as Record<string, unknown>,
    {
      set(target, key, value) {
        state[String(key)] = value;
        return true;
      },
      get(target, key) {
        return key in state ? state[String(key)] : target[String(key)];
      },
    }
  );
  return { ctx, calls, state };
}

describe('identityWatermarkText', () => {
  it('joins name and ID with " · "', () => {
    expect(identityWatermarkText('Ahmed Ali', 'ID: 3F9A1C2B')).toBe('Ahmed Ali · ID: 3F9A1C2B');
  });
  it('keeps an Arabic name intact', () => {
    expect(identityWatermarkText('أحمد علي', 'ID: 3F9A1C2B')).toBe('أحمد علي · ID: 3F9A1C2B');
  });
  it('shows the name alone when there is no ID, and never invents one', () => {
    expect(identityWatermarkText('Ahmed Ali', null)).toBe('Ahmed Ali');
    expect(identityWatermarkText('Ahmed Ali', '  ')).toBe('Ahmed Ali');
  });
  it('shows the ID alone when the name is blank', () => {
    expect(identityWatermarkText(' ', 'ID: 3F9A1C2B')).toBe('ID: 3F9A1C2B');
  });
});

describe('placement (one centred copy, inside 75 % of the page)', () => {
  it('an A4 portrait page is width-limited and centred', () => {
    const box = wm.placement(1240, 1754, IMAGE.naturalWidth, IMAGE.naturalHeight)!;
    expect(box.width).toBeCloseTo(1240 * PDF_WATERMARK_MAX_PAGE_FRACTION);
    expect(box.x).toBeCloseTo((1240 - box.width) / 2);
    expect(box.y).toBeCloseTo((1754 - box.height) / 2);
  });

  it('a landscape page is height-limited', () => {
    const box = wm.placement(1754, 1240, IMAGE.naturalWidth, IMAGE.naturalHeight)!;
    expect(box.height).toBeCloseTo(1240 * PDF_WATERMARK_MAX_PAGE_FRACTION);
  });

  it.each([
    [1240, 1754],
    [1754, 1240],
    [800, 800],
    [600, 3000],
    [3000, 600],
  ])('keeps the aspect ratio and stays inside a %ix%i page', (w, h) => {
    const box = wm.placement(w, h, IMAGE.naturalWidth, IMAGE.naturalHeight)!;
    expect(box.width / box.height).toBeCloseTo(IMAGE.naturalWidth / IMAGE.naturalHeight);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
    expect(box.y + box.height).toBeLessThanOrEqual(h);
  });

  it('scales linearly with the canvas size (render DPR)', () => {
    const one = wm.placement(620, 877, IMAGE.naturalWidth, IMAGE.naturalHeight)!;
    const two = wm.placement(1240, 1754, IMAGE.naturalWidth, IMAGE.naturalHeight)!;
    expect(two.width).toBeCloseTo(one.width * 2);
  });

  it.each([
    [0, 100],
    [-1, 100],
    [Number.NaN, 100],
    [Number.POSITIVE_INFINITY, 100],
  ])('returns null for a %s-wide page', (w, h) => {
    expect(wm.placement(w, h, IMAGE.naturalWidth, IMAGE.naturalHeight)).toBeNull();
  });
});

describe('burnImage', () => {
  it('draws once with the web opacity and multiply blending, inside save/restore', () => {
    const { ctx, calls, state } = fakeContext();
    wm.burnImage(ctx, 1240, 1754, IMAGE);
    expect(calls.filter((c) => c.startsWith('drawImage'))).toHaveLength(1);
    expect(calls[0]).toBe('save');
    expect(calls[calls.length - 1]).toBe('restore');
    expect(state.globalAlpha).toBe(PDF_WATERMARK_OPACITY);
    expect(state.globalCompositeOperation).toBe('multiply');
    expect(PDF_WATERMARK_OPACITY).toBeGreaterThan(0);
    expect(PDF_WATERMARK_OPACITY).toBeLessThanOrEqual(0.5);
  });

  it('never throws when drawing fails, and still restores the context', () => {
    const { ctx, calls } = fakeContext({
      drawImage: () => {
        throw new Error('tainted');
      },
    });
    expect(() => wm.burnImage(ctx, 1240, 1754, IMAGE)).not.toThrow();
    expect(calls[calls.length - 1]).toBe('restore');
  });

  it('does nothing without an image, or for a 0x0 one', () => {
    const { ctx, calls } = fakeContext();
    wm.burnImage(ctx, 1240, 1754, null);
    wm.burnImage(ctx, 1240, 1754, { naturalWidth: 0, naturalHeight: 0 });
    expect(calls.some((c) => c.startsWith('drawImage'))).toBe(false);
  });
});

describe('burnText (the tiled identity)', () => {
  it('uses the web typography, angle and opacity, scaled by the DPR', () => {
    const { ctx, calls, state } = fakeContext();
    wm.burnText(ctx, 1240, 1754, 'Ahmed Ali · ID: 3F9A1C2B', 2);
    expect(state.font).toBe('600 28px sans-serif');
    expect(state.fillStyle).toBe('#000000');
    expect(state.globalAlpha).toBe(0.1);
    expect(calls).toContain(`rotate:${-Math.PI / 7}`);
    // Tiled over the whole page, not a single stamp.
    expect(calls.filter((c) => c === 'fillText').length).toBeGreaterThan(20);
    expect(calls[calls.length - 1]).toBe('restore');
  });

  it('draws nothing for an empty identity', () => {
    const { ctx, calls } = fakeContext();
    wm.burnText(ctx, 1240, 1754, '', 2);
    expect(calls).toHaveLength(0);
  });
});

describe('buildPdfHtml', () => {
  const strings = { loading: 'Opening…', failed: 'Could not open' };

  it('burns both marks into every page after pdf.js renders it', () => {
    const html = buildPdfHtml('https://cdn.example/doc.pdf?sig=1', strings, {}, {
      imageDataUri: 'data:image/png;base64,AAAA',
      identity: 'Ahmed Ali · ID: 3F9A1C2B',
    });
    expect(html).toContain('var __swWatermark');
    expect(html).toMatch(/\.promise\.then\(function \(\) \{[\s\S]*burnImage\(ctx[\s\S]*burnText\(ctx/);
    expect(html).toContain('"Ahmed Ali · ID: 3F9A1C2B"');
    expect(html).toContain('"data:image/png;base64,AAAA"');
  });

  it('an identity cannot close the script element', () => {
    const html = buildPdfHtml('https://cdn.example/doc.pdf', strings, {}, {
      imageDataUri: null,
      identity: '</script><script>alert(1)</script>',
    });
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });

  it('still renders, text only, without the artwork', () => {
    const html = buildPdfHtml('https://cdn.example/doc.pdf', strings, {}, {
      imageDataUri: null,
      identity: 'Ahmed Ali',
    });
    expect(html).toContain('__swWatermark.loadImage(null');
  });

  it('isPdfUrl ignores the signature query string', () => {
    expect(isPdfUrl('https://cdn.example/a/b.PDF?X-Sig=abc.png')).toBe(true);
    expect(isPdfUrl('https://cdn.example/a/b.png?f=x.pdf')).toBe(false);
  });
});

describe('the shipped artwork', () => {
  const asset = fs.readFileSync(path.resolve(__dirname, '../assets/images/pdf-watermark.png'));

  it('is the Student Web file, byte for byte', () => {
    expect(crypto.createHash('sha256').update(asset).digest('hex')).toBe(
      '31e7860bcd05683746be7384dd028f93ed742103f39d82ba1ed9eb0088bb95ef'
    );
  });

  it('is a 1824x2003 PNG with an alpha channel', () => {
    expect(asset.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(asset.readUInt32BE(16)).toBe(1824);
    expect(asset.readUInt32BE(20)).toBe(2003);
    expect(asset[25]).toBe(6);
  });
});
