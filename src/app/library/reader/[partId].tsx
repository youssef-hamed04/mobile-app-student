import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { AppBar } from '@/components/layout/AppBar';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useOpenDocument } from '@/features/library/hooks';
import { Watermark } from '@/features/video/components/Watermark';
import { useProtectedScreen } from '@/hooks/use-content-protection';
import { useTranslation } from '@/hooks/use-translation';
import { SecureContentView, capabilities } from '@modules/content-protection';

/**
 * Reading a purchased library document.
 *
 * Deliberately the same security posture as the course-attachment viewer, and
 * for the same reason: this is paid content that the platform sells, and the
 * one thing that would destroy its value is a student being able to save a copy
 * and pass it on.
 *
 * So: a short-lived, viewer-bound URL requested at open time and never cached;
 * a capture-excluded surface; the student's own watermark painted over the
 * page; and a WebView that cannot navigate away, download, cache, select text
 * or open a window. The storage key behind the document is never sent to the
 * client at all — only a signature that expires.
 *
 * The ticket is requested with a mutation rather than a query precisely so it
 * cannot be replayed from cache after it has expired.
 */
export default function LibraryReaderScreen() {
  const { partId } = useLocalSearchParams<{ partId: string }>();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const router = useRouter();

  const { blockReason } = useProtectedScreen({});
  const open = useOpenDocument();

  const close = () =>
    router.canGoBack() ? router.back() : router.replace('/library');

  // One request per visit. Re-requesting on a re-render would burn a reading
  // record and mint a second watermark session for the same sitting.
  const requested = React.useRef(false);
  React.useEffect(() => {
    if (!partId || requested.current) return;
    if (!capabilities.supportsSecureSurface) return;
    requested.current = true;
    open.mutate(partId);
    // `open` is a stable mutation object; depending on it would re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId]);

  if (!capabilities.supportsSecureSurface || blockReason) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <AppBar title={t('security.title')} onBack={close} />
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="shieldAlert" size={34} />
          <Text variant="h3" className="mt-3 text-center">
            {blockReason === 'recording'
              ? t('player.recordingDetectedTitle')
              : t('security.integrityTitle')}
          </Text>
          <Text variant="caption" tone="muted" className="mt-2 text-center">
            {blockReason === 'recording'
              ? t('player.recordingDetectedBody')
              : t('security.integrityBody')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (open.isPending || (!open.data && !open.isError)) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <AppBar onBack={close} />
        <Spinner fullscreen label={t('library.opening')} />
      </SafeAreaView>
    );
  }

  if (open.isError || !open.data) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <AppBar onBack={close} />
        <ErrorState
          error={open.error}
          onRetry={() => {
            if (partId) open.mutate(partId);
          }}
        />
      </SafeAreaView>
    );
  }

  const ticket = open.data;
  const origin = new URL(ticket.url).origin;
  const withoutQuery = ticket.url.split('?')[0] ?? ticket.url;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppBar title={ticket.title} onBack={close} />

      <SecureContentView enabled style={{ flex: 1 }}>
        <View className="flex-1">
          <WebView
            source={{ uri: ticket.url }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            originWhitelist={[origin]}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            allowsLinkPreview={false}
            javaScriptCanOpenWindowsAutomatically={false}
            setSupportMultipleWindows={false}
            onFileDownload={() => undefined}
            incognito
            cacheEnabled={false}
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            onShouldStartLoadWithRequest={(req) => req.url.startsWith(withoutQuery)}
            injectedJavaScript={`
              document.addEventListener('contextmenu', e => e.preventDefault());
              const s = document.createElement('style');
              s.textContent = '*{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}';
              document.head.appendChild(s);
              true;
            `}
          />

          <Watermark payload={ticket.watermark} width={width} height={height} active />
        </View>
      </SecureContentView>
    </SafeAreaView>
  );
}
