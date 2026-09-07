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

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
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

  return (
    <Screen keyboardAvoiding edges={['top', 'bottom']} contentClassName="pt-2">
      <View className="mb-2 flex-row justify-end">
        <LanguageToggle />
      </View>

      <View className="mb-8 items-center">
        <BrandMark size={64} />
        <Text variant="h1" className="mt-5 text-center">
          {t('auth.welcomeBack')}
        </Text>
        <Text variant="caption" tone="muted" className="mt-1.5 text-center">
          {t('auth.loginSubtitle')}
        </Text>
      </View>

      {formError ? (
        <View className="mb-4">
          <InlineError error={formError} />
        </View>
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
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
          )}
        />

        <Link href="/(auth)/password-help" asChild>
          <Text variant="label" tone="primary" className="self-end">
            {t('auth.forgotPassword')}
          </Text>
        </Link>

        <Button
          label={isSubmitting ? t('auth.loggingIn') : t('auth.login')}
          onPress={onSubmit}
          loading={isSubmitting}
          size="lg"
          fullWidth
          className="mt-2"
        />
      </View>

      <View className="mt-8 flex-row items-center justify-center gap-1">
        <Text variant="caption" tone="muted">
          {t('auth.noAccount')}
        </Text>
        <Link href="/(auth)/register" asChild>
          <Text variant="label" tone="primary">
            {t('auth.createAccount')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
