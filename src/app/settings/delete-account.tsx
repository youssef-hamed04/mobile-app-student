import { useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, View } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { InlineError } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { env } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCreateTicket } from '@/features/support/hooks';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';

/**
 * Account deletion request.
 *
 * Both stores require that an app which lets people create an account also
 * lets them start deleting it from inside the app. The backend has no
 * self-service deletion endpoint (deletion is an admin action on
 * `DELETE /admin/users/:id`), so the request is filed through the existing,
 * authenticated support-ticket API — the same channel admins already work
 * from — and the student gets a tracked reference instead of an email
 * address. Nothing is deleted on the device beyond what logout already does.
 */
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const create = useCreateTicket();

  const submit = () => {
    Alert.alert(t('deleteAccount.confirmTitle'), t('deleteAccount.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('deleteAccount.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            const ticket = await create.mutateAsync({
              subject: t('deleteAccount.ticketSubject'),
              body: t('deleteAccount.ticketBody', {
                name: user?.fullName ?? '',
                phone: user?.phone ?? '',
              }),
              category: 'GENERAL',
            });
            router.replace(`/support/${ticket.id}`);
          } catch {
            // Rendered from the mutation state below.
          }
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']} padded={false} scroll>
      <AppBar title={t('deleteAccount.title')} showBack />

      <View className="gap-4 px-4 pb-10 pt-3">
        <Card>
          <CardBody className="gap-2">
            <Text variant="label">{t('deleteAccount.whatHappensTitle')}</Text>
            <Text variant="caption" tone="muted">
              {t('deleteAccount.whatHappensBody')}
            </Text>
          </CardBody>
        </Card>

        <Text variant="caption" tone="muted">
          {t('deleteAccount.processNote')}
        </Text>

        {create.isError ? <InlineError error={create.error} /> : null}

        <Button
          label={t('deleteAccount.submit')}
          variant="danger"
          iconStart="trash"
          loading={create.isPending}
          disabled={create.isPending}
          onPress={submit}
          fullWidth
        />

        {env.legal.accountDeletionUrl ? (
          <Button
            label={t('deleteAccount.webLink')}
            variant="link"
            onPress={() => void support.openLegal('accountDeletion')}
          />
        ) : null}
      </View>
    </Screen>
  );
}
