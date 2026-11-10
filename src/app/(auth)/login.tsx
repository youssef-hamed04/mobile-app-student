import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { asApiError, type ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/ErrorState';
import { Input, PasswordInput } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { authApi } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { type LoginInput, loginSchema } from '@/features/auth/schemas';
import { useFormErrors, messageParams } from '@/hooks/use-form-errors';
import { useTranslation } from '@/hooks/use-translation';
import { BrandMark } from '@/components/layout/BrandMark';
import { LanguageToggle } from '@/components/layout/LanguageToggle';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login, lastSessionError, clearSessionError } = useAuth();
  const { translate, applyServerErrors } = useFormErrors<LoginInput>();

  const [formError, setFormError] = React.useState<ApiError | null>(
    lastSessionError ?? null
  );

  const [cancelling, setCancelling] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setNotice(null);
    clearSessionError();

    try {
      // Zod's transform has already normalised the phone to 01XXXXXXXXX.
      const parsed = loginSchema.parse(values);
      await login(parsed);
      router.replace('/(tabs)');
    } catch (e) {
      const remaining = applyServerErrors(e, setError);
      if (remaining) setFormError(asApiError(remaining));
    }
  });

  /**
   * Owner decision D5: an account with a pending deletion cannot sign in, but
   * the same phone + password can cancel the deletion, and then sign in.
   */
  const cancelDeletion = async () => {
    setCancelling(true);
    try {
      const credentials = loginSchema.parse(getValues());
      await authApi.cancelAccountDeletion(credentials);
      setFormError(null);
      setNotice(t('deleteAccount.cancelled'));
      await login(credentials);
      router.replace('/(tabs)');
    } catch (e) {
      const apiError = asApiError(e);
      // Past its 30 days (or being erased): only support can help now.
      if (apiError.code === 'INVALID_STATE') setNotice(t('deleteAccount.cancelTooLate'));
      else setFormError(apiError);
    } finally {
      setCancelling(false);
    }
  };

  return (
    /*
     * The front door sits on the mark's own plate, in both themes — it
     * continues the splash rather than switching grounds a third of a second
     * after it. Everything on the plate is inked dark for the same reason the
     * logo is: nothing light reads on orange.
     */
    <Screen
      keyboardAvoiding
      edges={['top', 'bottom']}
      contentClassName="pt-2"
      background="bg-brand-400"
    >
      <View className="mb-2 flex-row justify-end">
        <LanguageToggle />
      </View>

      <View className="mb-8 items-center">
        <BrandMark width={232} onPlate />
        <Text variant="h1" tone="onHighlight" className="mt-5 text-center">
          {t('auth.welcomeBack')}
        </Text>
        <Text
          variant="caption"
          tone="none"
          className="mt-1.5 text-center text-brand-900"
        >
          {t('auth.loginSubtitle')}
        </Text>
      </View>

      {formError ? (
        <View className="mb-4 gap-3">
          <InlineError error={formError} onPlate />
          {formError.code === 'ACCOUNT_DELETION_PENDING' ? (
            <Button
              label={t('deleteAccount.cancelAction')}
              onPress={() => void cancelDeletion()}
              loading={cancelling}
              disabled={cancelling || isSubmitting}
              variant="onPlate"
              fullWidth
            />
          ) : null}
        </View>
      ) : null}

      {notice ? (
        <Text variant="label" tone="none" className="mb-4 text-center text-brand-900">
          {notice}
        </Text>
      ) : null}

      <View className="gap-4">
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              label={t('auth.phone')}
              placeholder={t('auth.phonePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={translate(errors.phone?.message, messageParams(errors.phone?.message ?? ''))}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              iconStart="phone"
              required
              onPlate
              forceLTR
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <PasswordInput
              label={t('auth.password')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={translate(
                errors.password?.message,
                messageParams(errors.password?.message ?? '')
              )}
              required
              onPlate
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
          )}
        />

        {/* The mark's red is 2.8:1 on the plate, so links take the deep red
            from the same ramp (6.5:1) rather than the brand value. */}
        <Link href="/(auth)/password-help" asChild>
          <Text variant="label" tone="none" className="self-end text-danger-800 underline">
            {t('auth.forgotPassword')}
          </Text>
        </Link>

        <Button
          label={isSubmitting ? t('auth.loggingIn') : t('auth.login')}
          onPress={onSubmit}
          loading={isSubmitting}
          variant="onPlate"
          size="lg"
          fullWidth
          className="mt-2"
        />
      </View>

      <View className="mt-8 flex-row items-center justify-center gap-1">
        <Text variant="caption" tone="none" className="text-brand-900">
          {t('auth.noAccount')}
        </Text>
        <Link href="/(auth)/register" asChild>
          <Text variant="label" tone="none" className="text-danger-800 underline">
            {t('auth.createAccount')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
