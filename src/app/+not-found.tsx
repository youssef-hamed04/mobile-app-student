import { Stack, useRouter } from 'expo-router';
import * as React from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/hooks/use-translation';

export default function NotFound() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: t('errors.notFoundScreen.title') }} />
      <Screen>
        <EmptyState
          icon="help"
          title={t('errors.notFoundScreen.title')}
          body={t('errors.notFoundScreen.body')}
          actionLabel={t('errors.notFoundScreen.action')}
          onAction={() => router.replace('/(tabs)')}
        />
      </Screen>
    </>
  );
}
