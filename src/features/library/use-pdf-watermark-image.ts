import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as React from 'react';

import { PDF_WATERMARK_LOAD_TIMEOUT_MS } from './pdf-watermark';

let cachedDataUri: Promise<string | null> | null = null;

/**
 * The bundled Student Web artwork as a `data:` URI.
 *
 * A data URI because the reader page runs on the document CDN's origin (see
 * pdf-html.ts), which cannot load a file from the app bundle; a data URI also
 * keeps the canvas untainted. Read once per process and reused.
 */
function loadWatermarkDataUri(): Promise<string | null> {
  if (!cachedDataUri) {
    cachedDataUri = (async () => {
      try {
        const asset = Asset.fromModule(require('../../../assets/images/pdf-watermark.png'));
        await asset.downloadAsync();
        if (!asset.localUri) return null;
        const base64 = await new File(asset.localUri).base64();
        return base64 ? `data:image/png;base64,${base64}` : null;
      } catch {
        return null;
      }
    })();
    // A failure is not cached: the next document tries again.
    void cachedDataUri.then((uri) => {
      if (uri === null) cachedDataUri = null;
    });
  }
  return cachedDataUri;
}

/**
 * `undefined` while loading, then the data URI or `null`.
 *
 * Settles exactly once. Past PDF_WATERMARK_LOAD_TIMEOUT_MS it settles on null
 * (identity text only, as the web does), and a late image is then ignored:
 * swapping it in would rebuild the page and reload a document the student is
 * already reading.
 */
export function usePdfWatermarkImage(): string | null | undefined {
  const [uri, setUri] = React.useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    let active = true;
    const settle = (value: string | null) => {
      if (active) setUri((current) => (current === undefined ? value : current));
    };

    const timer = setTimeout(() => settle(null), PDF_WATERMARK_LOAD_TIMEOUT_MS);
    void loadWatermarkDataUri().then((value) => {
      clearTimeout(timer);
      settle(value);
    });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return uri;
}
