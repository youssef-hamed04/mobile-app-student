/**
 * The page that actually draws a PDF.
 *
 * Android's WebView has no PDF renderer — pointing it at a document URL paints
 * a blank white page with no error at all. pdf.js draws the pages onto canvases
 * instead, which works identically on both platforms, so there is one code path
 * rather than "works on iOS, silently blank on Android".
 *
 * Two properties are load-bearing and easy to break:
 *
 *   1. The page is mounted with `baseUrl` set to the document's own origin, so
 *      fetching the signed URL from inside is SAME-ORIGIN. Without that the
 *      edge would need CORS headers it deliberately does not send.
 *
 *   2. pdf.js is pinned to one version and carries a Subresource Integrity
 *      hash, so a compromised CDN cannot swap in different code. This page
 *      holds paid content; an unpinned third-party script beside it would be a
 *      way to read that content out.
 *
 * The bytes never leave the device: pdf.js runs locally and only ever renders
 * to a canvas. Nothing is written to storage and there is no download path.
 */

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// sha384, computed from the exact files this version serves.
const PDFJS_SRI =
  'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';

export interface PdfPageStrings {
  /** Shown while the document is being fetched and drawn. */
  loading: string;
  /** Shown when it could not be rendered at all. */
  failed: string;
}

/**
 * `documentUrl` is the short-lived, viewer-bound URL. It is embedded as a JSON
 * string literal so a key containing a quote cannot break out of the script.
 */
export function buildPdfHtml(
  documentUrl: string,
  strings: PdfPageStrings,
  /** Extra request headers the grant requires; course attachments send them. */
  headers: Record<string, string> = {}
): string {
  const url = JSON.stringify(documentUrl);
  const loading = JSON.stringify(strings.loading);
  const failed = JSON.stringify(strings.failed);
  const httpHeaders = JSON.stringify(headers);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4">
<style>
  html, body { margin:0; padding:0; background:#0b0b0d; }
  #pages { padding: 8px 0 24px; }
  canvas { display:block; width:100%; height:auto; margin:0 auto 10px; background:#fff; }
  #status {
    color:#e7e7ea; font:15px -apple-system, Roboto, sans-serif;
    padding:32px 24px; text-align:center; line-height:1.6;
  }
  * { -webkit-user-select:none !important; user-select:none !important;
      -webkit-touch-callout:none !important; }
</style>
</head>
<body>
<div id="pages"></div>
<div id="status">${loading.slice(1, -1)}</div>
<script src="${PDFJS_BASE}/pdf.min.js" integrity="${PDFJS_SRI}" crossorigin="anonymous"></script>
<script>
(function () {
  var pages  = document.getElementById('pages');
  var status = document.getElementById('status');
  var FAILED = ${failed};

  function report(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  }

  function fail(reason) { status.textContent = FAILED; report('fail:' + reason); }

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  if (!window.pdfjsLib) { fail('pdfjs-script-blocked'); return; }

  // Cross-origin workers cannot be constructed directly, so the worker is
  // fetched and handed over as a blob from this origin. pdf.js would otherwise
  // fall back to running on the main thread, which blocks scrolling on a long
  // document.
  function workerReady() {
    return fetch('${PDFJS_BASE}/pdf.worker.min.js')
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (src) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      })
      .catch(function () { /* main-thread fallback is still correct */ });
  }

  workerReady().then(function () {
    return pdfjsLib.getDocument({ url: ${url}, httpHeaders: ${httpHeaders} }).promise;
  }).then(function (doc) {
    status.textContent = '';

    // Draw above CSS resolution so text stays sharp when the reader zooms in,
    // but cap it — a tall page at 4x on a dense screen can exhaust the canvas
    // memory limit and render nothing at all.
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = pages.clientWidth || window.innerWidth;
    var chain = Promise.resolve();

    for (var i = 1; i <= doc.numPages; i++) {
      (function (n) {
        chain = chain.then(function () {
          return doc.getPage(n).then(function (page) {
            var base = page.getViewport({ scale: 1 });
            var viewport = page.getViewport({ scale: (width / base.width) * dpr });
            var canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            pages.appendChild(canvas);
            return page.render({
              canvasContext: canvas.getContext('2d'),
              viewport: viewport,
            }).promise;
          });
        });
      })(i);
    }

    return chain.then(function () { report('ok:' + doc.numPages); });
  }).catch(function (e) { fail(String((e && (e.name || e.message)) || e)); });
})();
</script>
</body>
</html>`;
}
