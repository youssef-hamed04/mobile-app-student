import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { qk } from '@/api/query-keys';
import { AppBar } from '@/components/layout/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { updateProfileSchema } from '@/features/auth/schemas';
import { useChangeAvatar, useRemoveAvatar } from '@/features/profile/hooks';
import { messageParams, useFormErrors } from '@/hooks/use-form-errors';
import { useTranslation } from '@/hooks/use-translation';
import { toast } from '@/store/ui-store';
import type { User } from '@/types/domain';
import { localizedName, maskPhone } from '@/utils/format';

interface FormValues {
  fullName: string;
}

/**
 * Profile editing.
 *
 * Only the fields a student may change on their own are editable. Phone and
 * the academic fields are administrative — they identify the account and
 * determine course eligibility — so they are shown read-only with a route to
 * the administration rather than silently disabled inputs.
 */
export default function EditProfileScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const changeAvatar = useChangeAvatar();
  const removeAvatar = useRemoveAvatar();
  const { translate, applyServerErrors } = useFormErrors<FormValues>();

  const [formError, setFormError] = React.useState<unknown>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: user?.fullName ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.patch<User>(Endpoints.profile.update, values),
    onSuccess: async (updated) => {
      queryClient.setQueryData(qk.auth.me(), updated);
      await refreshUser();
      toast.success(t('profile.profileUpdated'));
      router.back();
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await mutation.mutateAsync(values);
    } catch (e) {
      const remaining = applyServerErrors(e, form.setError);
      if (remaining) setFormError(remaining);
    }
  });

  if (!user) return null;

  return (
    <Screen padded={false} edges={['top']} keyboardAvoiding>
      <AppBar title={t('profile.editProfile')} />

      <Screen hideNetworkBanner edges={[]} keyboardAvoiding contentClassName="pt-5">
        {/*
          The picture is the one thing on this screen a student can change
          without an administrator. It goes straight to storage: the app
          presigns an upload, PUTs the bytes, and hands the server back only
          the key it chose. No image bytes ever pass through the API.
        */}
        <View className="mb-6 items-center">
          <Avatar name={user.fullName} uri={user.avatarUrl} size={92} />

          <View className="mt-2 flex-row items-center gap-1">
            <Button
              label={t('profile.changePhoto')}
              variant="link"
              size="sm"
              loading={changeAvatar.isPending}
              disabled={removeAvatar.isPending}
              onPress={() => changeAvatar.mutate()}
            />

            {user.avatarUrl ? (
              <Button
                label={t('profile.removePhoto')}
                variant="link"
                size="sm"
                loading={removeAvatar.isPending}
                disabled={changeAvatar.isPending}
                onPress={() => removeAvatar.mutate()}
              />
            ) : null}
          </View>
        </View>

        {formError ? (
          <View className="mb-4">
            <InlineError error={formError} />
          </View>
        ) : null}

        <Controller
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <Input
              label={t('auth.fullName')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={translate(
                form.formState.errors.fullName?.message,
                messageParams(form.formState.errors.fullName?.message ?? '')
              )}
              iconStart="personOutline"
              required
            />
          )}
        />

        <View className="mt-6">
          <ListSection
            title={t('profile.personalInfo')}
            footer={t('profile.contactToChange')}
          >
            <ListItem title={t('auth.phone')} value={maskPhone(user.phone)} />
            <ListItem
              title={t('auth.gender')}
              value={user.gender === 'FEMALE' ? t('auth.female') : t('auth.male')}
            />
          </ListSection>

          <ListSection
            title={t('profile.academicInfo')}
            footer={t('profile.contactToChange')}
          >
            <ListItem
              title={t('auth.university')}
              value={localizedName(user.university, language)}
            />
            <ListItem
              title={t('auth.faculty')}
              value={localizedName(user.faculty, language)}
            />
            <ListItem
              title={t('auth.department')}
              value={localizedName(user.department, language)}
            />
            <ListItem
              title={t('auth.academicYear')}
              value={localizedName(user.academicYear, language)}
            />
          </ListSection>
        </View>

        <Text variant="caption" tone="subtle" className="mb-4">
          {t('profile.contactToChange')}
        </Text>
      </Screen>

      <View className="border-t border-border bg-surface px-4 pb-6 pt-3">
        <Button
          label={mutation.isPending ? t('common.saving') : t('common.save')}
          onPress={submit}
          loading={mutation.isPending}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}
