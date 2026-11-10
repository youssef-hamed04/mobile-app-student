import { useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, View } from 'react-native';

import { asApiError, type ApiError } from '@/api/errors';
import { AppBar } from '@/components/layout/AppBar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { InlineError } from '@/components/ui/ErrorState';
import { PasswordInput } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { env } from '@/config/env';
import { releaseFeatures } from '@/config/release-features';
import { authApi } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWallet } from '@/features/wallet/hooks';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';
import { formatDate, formatMoney } from '@/utils/format';

/**
 * In-app account deletion (owner decision D5; Google Play's account-deletion
 * requirement).
 *
 * `POST /auth/account-deletion` with the current password schedules the
 * deletion 30 days out and revokes every session server-side in the same call.
 * The student is then told the date and signed out locally. Signing in during
 * the 30 days is refused with ACCOUNT_DELETION_PENDING, and the login screen
 * offers "Cancel deletion" (`POST /auth/account-deletion/cancel`).
 *
 * After 30 days the server erases the personal data and keeps the payment,
 * wallet and enrolment records without it - the "What we keep" card says so.
 *
 * The current wallet balance is shown, and repeated in the confirmation,
 * before anything is sent. What happens to a remaining balance is an owner
 * policy that has not been decided, so the text states only facts: the
 * balance stays on record and cannot be used while deletion is pending or
 * afterwards, and the student is pointed to support. The button stays
 * disabled until the balance has loaded.
 */
export default function DeleteAccountScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { logout } = useAuth();
  const wallet = useWallet();
  const balance = wallet.data
    ? formatMoney({ amount: wallet.data.balance, currency: wallet.data.currency }, language)
    : null;
  const hasBalance = (wallet.data?.balance ?? 0) > 0;

  const [password, setPassword] = React.useState('');
  const [fieldError, setFieldError] = React.useState<string | undefined>();
  const [error, setError] = React.useState<ApiError | null>(null);
  const [busy, setBusy] = React.useState(false);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const request = await authApi.requestAccountDeletion(password);
      setPassword('');
      // The server has already ended every session; this clears the device.
      await logout();
      Alert.alert(
        t('deleteAccount.scheduledTitle'),
        t('deleteAccount.scheduledBody', { date: formatDate(request.scheduledFor, language) })
      );
      router.replace('/(auth)/login');
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === 'INVALID_CREDENTIALS') {
        setFieldError(t('errors.INVALID_CREDENTIALS'));
      } else {
        setError(apiError);
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    setFieldError(undefined);
    if (!password) {
      setFieldError(t('deleteAccount.passwordRequired'));
      return;
    }
    if (!wallet.data) return;
    const confirmBody = hasBalance
      ? `${t('deleteAccount.confirmBody')}\n\n${t('deleteAccount.confirmBalance', { amount: balance ?? '' })}`
      : t('deleteAccount.confirmBody');
    Alert.alert(t('deleteAccount.confirmTitle'), confirmBody, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('deleteAccount.confirm'), style: 'destructive', onPress: () => void send() },
    ]);
  };

  return (
    <Screen edges={['top']} padded={false} scroll keyboardAvoiding>
      <AppBar title={t('deleteAccount.title')} showBack />

      <View className="gap-4 px-4 pb-10 pt-3">
        <Card>
          <CardBody className="gap-2">
            <Text variant="label">{t('deleteAccount.whatHappensTitle')}</Text>
            <Text variant="caption" tone="muted">
              {t(releaseFeatures.wallet ? 'deleteAccount.whatHappensBody' : 'release.deleteWhatHappensBody')}
            </Text>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-2">
            <Text variant="label">{t('deleteAccount.keptTitle')}</Text>
            <Text variant="caption" tone="muted">
              {t(releaseFeatures.wallet ? 'deleteAccount.keptBody' : 'release.deleteKeptBody')}
            </Text>
          </CardBody>
        </Card>

        {/* With the wallet off, this appears only for a student who actually holds
            a balance (they must be told what they lose) or when it can't be loaded
            (the delete button waits for it, so a retry has to be reachable). */}
        {releaseFeatures.wallet || hasBalance || wallet.isError ? (
        <Card>
          <CardBody className="gap-2">
            <Text variant="label">{t('deleteAccount.walletTitle')}</Text>
            {wallet.isPending ? (
              <Text variant="caption" tone="muted">
                {t('deleteAccount.walletLoading')}
              </Text>
            ) : wallet.isError ? (
              <>
                <Text variant="caption" tone="muted">
                  {t('deleteAccount.walletLoadFailed')}
                </Text>
                <Button label={t('common.retry')} variant="link" onPress={() => void wallet.refetch()} />
              </>
            ) : (
              <>
                <Text variant="body">{t('deleteAccount.walletBalance', { amount: balance ?? '' })}</Text>
                <Text variant="caption" tone="muted">
                  {hasBalance ? t('deleteAccount.walletNote') : t('deleteAccount.walletZero')}
                </Text>
              </>
            )}
          </CardBody>
        </Card>
        ) : null}

        <Text variant="caption" tone="muted">
          {t('deleteAccount.processNote')}
        </Text>

        <PasswordInput
          label={t('deleteAccount.passwordLabel')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (fieldError) setFieldError(undefined);
          }}
          error={fieldError}
          required
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        {error ? <InlineError error={error} /> : null}

        <Button
          label={t('deleteAccount.submit')}
          variant="danger"
          iconStart="trash"
          loading={busy}
          disabled={busy || !wallet.data}
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
