import { SecureContentView, capabilities } from '@modules/content-protection';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { qk } from '@/api/query-keys';
import { AppBar } from '@/components/layout/AppBar';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { lessonsApi } from '@/features/lessons/api';
import { Watermark } from '@/features/video/components/Watermark';
import { useProtectedScreen } from '@/hooks/use-content-protection';
import { useTranslation } from '@/hooks/use-translation';

/**
 * Protected document viewer.
 *
 * Same security model as video: a short-lived ticket, a capture-excluded
 * surface, and the student's watermark on top. The WebView is locked down —
 * no file access, no downloads, no navigation away from the ticketed URL, no
 * text selection — so a protected PDF can't be saved or shared out of the app.
 */
export default function AttachmentViewer() {
  const { attachmentId } = useLocalSearchParams<{ attachmentId: string }>();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const router = useRouter();

  const { blockReason } = useProtectedScreen({});

  const query = useQuery({
    queryKey: qk.attachments.ticket(attachmentId ?? 'none'),
    queryFn: () => lessonsApi.attachmentTicket(attachmentId!),
    enabled: !!attachmentId && capabilities.supportsSecureSurface,
    gcTime: 0,
    staleTime: 0,
  });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

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

  if (query.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <AppBar onBack={close} />
        <Spinner fullscreen label={t('player.authorizing')} />
      </SafeAreaView>
    );
  }

  if (query.isError || !query.data) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <AppBar onBack={close} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }

  const ticket = query.data;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppBar title={t('courses.materials')} onBack={close} />

      <SecureContentView enabled style={{ flex: 1 }}>
        <View className="flex-1">
          <WebView
            source={{ uri: ticket.url, headers: ticket.headers }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            originWhitelist={[new URL(ticket.url).origin]}
            // Hardening: nothing may leave this view.
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
            onShouldStartLoadWithRequest={(req) =>
              req.url.startsWith(ticket.url.split('?')[0] ?? ticket.url)
            }
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
