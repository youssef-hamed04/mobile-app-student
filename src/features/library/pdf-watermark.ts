import type { WatermarkPayload } from '@/types/domain';

/**
 * The Student Web PDF watermark, burned into every page the reader draws.
 *
 * Ported from student-web (`src/lib/pdf-watermark.ts`,
 * `src/components/protection/Watermark.tsx`, used by
 * `src/components/documents/ProtectedPdf.tsx`) with the same asset and the
 * same numbers, so a page looks the same on the phone as in the browser:
 *
 *   1. The brand artwork (`assets/images/pdf-watermark.png`, byte-identical to
 *      the web's `src/assets/brand/pdf-watermark.png`: "مكتبة" + "Student
 *      Center", halftone, already rotated). One copy per page, centred, fitted
 *      inside 75 % of the page width AND height, alpha 0.35, `multiply`.
 *   2. The student's identity from the grant ("Name · ID: …"), tiled
 *      diagonally across the whole page: 600 14px sans-serif scaled by the
 *      render DPR, black at alpha 0.1, rotated -π/7.
 *
 * Both are drawn INTO the page canvas after pdf.js paints it, which is why they
 * scroll and pinch-zoom with the page and are present on every page. The PDF
 * file itself is not modified: the signed document is fetched and rendered
 * exactly as before, and the marks exist only in the rendered pixels.
 */

export const PDF_WATERMARK_OPACITY = 0.35;
export const PDF_WATERMARK_MAX_PAGE_FRACTION = 0.75;
export const PDF_WATERMARK_LOAD_TIMEOUT_MS = 8000;

/** "Name · ID: 3F9A1C2B"; either part alone when the other is blank. */
export function identityWatermarkText(
  primary: string | null | undefined,
  secondary: string | null | undefined
): string {
  return [primary, secondary]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

export function identityFromPayload(payload: WatermarkPayload | null | undefined): string {
  return identityWatermarkText(payload?.primary, payload?.secondary);
}

/**
 * Browser-side drawing code, injected into the pdf.js page as source text.
 *
 * Kept as a string on purpose. Serialising real functions with toString()
 * would break in release builds: Hermes returns "[bytecode]" for compiled
 * functions. The tests evaluate this same string, so what is tested is what
 * the WebView runs.
 *
 * Defines `__swWatermark` with `placement`, `burnImage` and `burnText`.
 */
export const PDF_WATERMARK_SCRIPT = `
var __swWatermark = (function () {
  var OPACITY = ${PDF_WATERMARK_OPACITY};
  var MAX_FRACTION = ${PDF_WATERMARK_MAX_PAGE_FRACTION};

  function placement(pageW, pageH, imageW, imageH) {
    if (!(pageW > 0) || !(pageH > 0) || !(imageW > 0) || !(imageH > 0)) return null;
    if (!isFinite(pageW) || !isFinite(pageH) || !isFinite(imageW) || !isFinite(imageH)) return null;
    var scale = Math.min((pageW * MAX_FRACTION) / imageW, (pageH * MAX_FRACTION) / imageH);
    var width = imageW * scale;
    var height = imageH * scale;
    return { x: (pageW - width) / 2, y: (pageH - height) / 2, width: width, height: height };
  }

  function burnImage(ctx, pageW, pageH, image) {
    if (!image) return;
    var box = placement(pageW, pageH, image.naturalWidth || image.width, image.naturalHeight || image.height);
    if (!box) return;
    ctx.save();
    try {
      ctx.globalAlpha = OPACITY;
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, box.x, box.y, box.width, box.height);
    } catch (e) {
      // A watermark failure never costs the student the page.
    } finally {
      ctx.restore();
    }
  }

  function burnText(ctx, pageW, pageH, text, scale) {
    if (!text) return;
    ctx.save();
    try {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#000000';
      ctx.font = '600 ' + Math.round(14 * scale) + 'px sans-serif';
      ctx.translate(pageW / 2, pageH / 2);
      ctx.rotate(-Math.PI / 7);
      var stepX = Math.max(ctx.measureText(text).width + 80 * scale, 200 * scale);
      var stepY = 110 * scale;
      var reach = Math.hypot(pageW, pageH);
      for (var y = -reach; y < reach; y += stepY) {
        var offset = (Math.round(y / stepY) % 2) * (stepX / 2);
        for (var x = -reach; x < reach; x += stepX) ctx.fillText(text, x + offset, y);
      }
    } catch (e) {
      // As above: the page still shows.
    } finally {
      ctx.restore();
    }
  }

  /** Resolves to the image, or null on error, zero size or timeout. Never rejects. */
  function loadImage(src, timeoutMs) {
    return new Promise(function (resolve) {
      if (!src || typeof Image === 'undefined') { resolve(null); return; }
      var done = false;
      var img = new Image();
      var finish = function (value) { if (!done) { done = true; resolve(value); } };
      var timer = setTimeout(function () { finish(null); }, timeoutMs);
      img.onload = function () {
        clearTimeout(timer);
        finish((img.naturalWidth || img.width) > 0 ? img : null);
      };
      img.onerror = function () { clearTimeout(timer); finish(null); };
      img.src = src;
    });
  }

  return { placement: placement, burnImage: burnImage, burnText: burnText, loadImage: loadImage };
})();
`;
