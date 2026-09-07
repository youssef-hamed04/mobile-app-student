import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { type ApiError, asApiError } from '@/api/errors';
import { AppBar } from '@/components/layout/AppBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { InlineError } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Input, PasswordInput } from '@/components/ui/Input';
import { ListItem } from '@/components/ui/ListItem';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { PasswordStrengthMeter } from '@/features/auth/components/PasswordStrengthMeter';
import {
  useAcademicYears,
  useDepartments,
  useFaculties,
  useUniversities,
} from '@/features/auth/hooks';
import {
  registerAcademicSchema,
  registerAccountSchema,
} from '@/features/auth/schemas';
import { messageParams, useFormErrors } from '@/hooks/use-form-errors';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

type Step = 0 | 1 | 2;
const TOTAL_STEPS = 3;

interface AccountForm {
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface AcademicForm {
  universityId: string;
  facultyId: string;
  departmentId: string;
  academicYearId: string;
  gender: 'MALE' | 'FEMALE' | '';
}

/**
 * Three-step registration.
 *
 * Split into steps because the single-screen version is eleven fields long on
 * a phone, and because the academic fields are *dependent* — asking for a
 * department before a faculty is chosen produces an empty picker that reads
 * as broken. Each step validates with its own schema so a student can't be
 * blocked on step 3 by a mistake made on step 1.
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { register: doRegister } = useAuth();

  const [step, setStep] = React.useState<Step>(0);
  const [formError, setFormError] = React.useState<ApiError | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const accountErrors = useFormErrors<AccountForm>();
  const academicErrors = useFormErrors<AcademicForm>();

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(registerAccountSchema),
    defaultValues: { fullName: '', phone: '', password: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const academicForm = useForm<AcademicForm>({
    resolver: zodResolver(registerAcademicSchema),
    defaultValues: {
      universityId: '',
      facultyId: '',
      departmentId: '',
      academicYearId: '',
      gender: '',
    },
    mode: 'onChange',
  });

  const universityId = academicForm.watch('universityId');
  const facultyId = academicForm.watch('facultyId');
  const password = accountForm.watch('password');

  const universities = useUniversities();
  const faculties = useFaculties(universityId || null);
  const departments = useDepartments(facultyId || null);
  const years = useAcademicYears();

  // Clear dependent selections when a parent changes, so the student can
  // never submit a department that doesn't belong to the chosen faculty.
  React.useEffect(() => {
    academicForm.setValue('facultyId', '');
    academicForm.setValue('departmentId', '');
  }, [universityId, academicForm]);

  React.useEffect(() => {
    academicForm.setValue('departmentId', '');
  }, [facultyId, academicForm]);

  const goNext = async () => {
    setFormError(null);

    if (step === 0) {
      const ok = await accountForm.trigger();
      if (ok) setStep(1);
      return;
    }
    if (step === 1) {
      const ok = await academicForm.trigger();
      if (ok) setStep(2);
    }
  };

  const goBack = () => {
    setFormError(null);
    if (step === 0) router.back();
    else setStep((s) => (s - 1) as Step);
  };

  const submit = async () => {
    setSubmitting(true);
    setFormError(null);

    try {
      const account = registerAccountSchema.parse(accountForm.getValues());
      const academic = registerAcademicSchema.parse(academicForm.getValues());

      await doRegister({
        fullName: account.fullName,
        phone: account.phone,
        password: account.password,
        ...academic,
      });

      router.replace('/(tabs)');
    } catch (e) {
      // Field errors can belong to either sub-form; try both, then fall back
      // to a banner.
      const remainingAccount = accountErrors.applyServerErrors(
        e,
        accountForm.setError
      );
      const remainingAcademic = academicErrors.applyServerErrors(
        e,
        academicForm.setError
      );
      if (remainingAccount && remainingAcademic) {
        setFormError(asApiError(e));
        // Send the student back to the step that owns the failing field.
        if (asApiError(e).code === 'PHONE_ALREADY_REGISTERED') setStep(0);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const values = { ...accountForm.getValues(), ...academicForm.getValues() };

  const labelFor = (
    list: { value: string; label: string }[] | undefined,
    id: string
  ) => list?.find((o) => o.value === id)?.label ?? '—';

  return (
    <Screen keyboardAvoiding edges={['top', 'bottom']} padded={false}>
      <AppBar
        title={t('auth.createAccount')}
        subtitle={t('auth.stepOf', { current: step + 1, total: TOTAL_STEPS })}
        onBack={goBack}
      />

      <View className="px-4 pt-3">
        <ProgressBar percent={((step + 1) / TOTAL_STEPS) * 100} size="xs" />
      </View>

      <Screen padded scroll hideNetworkBanner edges={[]} contentClassName="pt-5">
        {formError ? (
          <View className="mb-4">
            <InlineError error={formError} />
          </View>
        ) : null}

        {step === 0 ? (
          <View className="gap-4">
            <Text variant="h3">{t('auth.accountInfo')}</Text>

            <Controller
              control={accountForm.control}
              name="fullName"
              render={({ field }) => (
                <Input
                  label={t('auth.fullName')}
                  placeholder={t('auth.fullNamePlaceholder')}
                  hint={t('auth.fullNameHint')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={accountErrors.translate(
                    accountForm.formState.errors.fullName?.message,
                    messageParams(accountForm.formState.errors.fullName?.message ?? '')
                  )}
                  autoComplete="name"
                  textContentType="name"
                  iconStart="personOutline"
                  required
                />
              )}
            />

            <Controller
              control={accountForm.control}
              name="phone"
              render={({ field }) => (
                <Input
                  label={t('auth.phone')}
                  placeholder={t('auth.phonePlaceholder')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={accountErrors.translate(
                    accountForm.formState.errors.phone?.message
                  )}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  iconStart="phone"
                  required
                  forceLTR
                />
              )}
            />

            <View>
              <Controller
                control={accountForm.control}
                name="password"
                render={({ field }) => (
                  <PasswordInput
                    label={t('auth.password')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={accountErrors.translate(
                      accountForm.formState.errors.password?.message,
                      messageParams(
                        accountForm.formState.errors.password?.message ?? ''
                      )
                    )}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    required
                  />
                )}
              />
              <PasswordStrengthMeter value={password} />
            </View>

            <Controller
              control={accountForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <PasswordInput
                  label={t('auth.confirmPassword')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={accountErrors.translate(
                    accountForm.formState.errors.confirmPassword?.message
                  )}
                  required
                />
              )}
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View className="gap-4">
            <Text variant="h3">{t('auth.academicInfo')}</Text>

            <Controller
              control={academicForm.control}
              name="universityId"
              render={({ field }) => (
                <Select
                  label={t('auth.university')}
                  value={field.value || null}
                  options={universities.data ?? []}
                  onChange={field.onChange}
                  loading={universities.isLoading}
                  error={academicErrors.translate(
                    academicForm.formState.errors.universityId?.message
                  )}
                  required
                />
              )}
            />

            <Controller
              control={academicForm.control}
              name="facultyId"
              render={({ field }) => (
                <Select
                  label={t('auth.faculty')}
                  value={field.value || null}
                  options={faculties.data ?? []}
                  onChange={field.onChange}
                  loading={faculties.isFetching}
                  disabled={!universityId}
                  emptyMessage={t('courses.empty.listBody')}
                  error={academicErrors.translate(
                    academicForm.formState.errors.facultyId?.message
                  )}
                  required
                />
              )}
            />

            <Controller
              control={academicForm.control}
              name="departmentId"
              render={({ field }) => (
                <Select
                  label={t('auth.department')}
                  value={field.value || null}
                  options={departments.data ?? []}
                  onChange={field.onChange}
                  loading={departments.isFetching}
                  disabled={!facultyId}
                  emptyMessage={t('courses.empty.listBody')}
                  error={academicErrors.translate(
                    academicForm.formState.errors.departmentId?.message
                  )}
                  required
                />
              )}
            />

            <Controller
              control={academicForm.control}
              name="academicYearId"
              render={({ field }) => (
                <Select
                  label={t('auth.academicYear')}
                  value={field.value || null}
                  options={years.data ?? []}
                  onChange={field.onChange}
                  loading={years.isLoading}
                  error={academicErrors.translate(
                    academicForm.formState.errors.academicYearId?.message
                  )}
                  required
                />
              )}
            />

            <Controller
              control={academicForm.control}
              name="gender"
              render={({ field }) => (
                <View className="gap-2">
                  <Text variant="label">{t('auth.gender')}</Text>
                  <View className="flex-row gap-2">
                    <Chip
                      label={t('auth.male')}
                      selected={field.value === 'MALE'}
                      onPress={() => field.onChange('MALE')}
                    />
                    <Chip
                      label={t('auth.female')}
                      selected={field.value === 'FEMALE'}
                      onPress={() => field.onChange('FEMALE')}
                    />
                  </View>
                  {academicForm.formState.errors.gender ? (
                    <Text variant="caption" tone="accent">
                      {academicErrors.translate(
                        academicForm.formState.errors.gender.message
                      )}
                    </Text>
                  ) : null}
                </View>
              )}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View className="gap-4">
            <Text variant="h3">{t('auth.reviewInfo')}</Text>
            <Text variant="caption" tone="muted">
              {t('auth.reviewNote')}
            </Text>

            <View className="overflow-hidden rounded-lg border border-border">
              <ListItem title={t('auth.fullName')} value={values.fullName} />
              <ListItem title={t('auth.phone')} value={values.phone} />
              <ListItem
                title={t('auth.university')}
                value={labelFor(universities.data, values.universityId)}
              />
              <ListItem
                title={t('auth.faculty')}
                value={labelFor(faculties.data, values.facultyId)}
              />
              <ListItem
                title={t('auth.department')}
                value={labelFor(departments.data, values.departmentId)}
              />
              <ListItem
                title={t('auth.academicYear')}
                value={labelFor(years.data, values.academicYearId)}
              />
              <ListItem
                title={t('auth.gender')}
                value={values.gender === 'FEMALE' ? t('auth.female') : t('auth.male')}
              />
            </View>

            <Card className="border-primary/30 bg-primary-soft">
              <CardBody className="flex-row gap-3">
                <Icon name="device" size={20} color={colors.primary} />
                <View className="flex-1">
                  <Text variant="label" tone="primary">
                    {t('auth.deviceNoticeTitle')}
                  </Text>
                  <Text variant="caption" tone="muted" className="mt-1">
                    {t('auth.deviceNoticeBody')}
                  </Text>
                </View>
              </CardBody>
            </Card>

            <Text variant="caption" tone="subtle">
              {t('auth.termsNotice')}
            </Text>
          </View>
        ) : null}
      </Screen>

      <View className="gap-3 border-t border-border bg-surface px-4 pb-6 pt-3">
        {step < 2 ? (
          <Button label={t('common.next')} onPress={goNext} size="lg" fullWidth iconEnd="chevron-right" />
        ) : (
          <Button
            label={submitting ? t('auth.registering') : t('auth.register')}
            onPress={submit}
            loading={submitting}
            size="lg"
            fullWidth
          />
        )}

        {step === 0 ? (
          <View className="flex-row items-center justify-center gap-1">
            <Text variant="caption" tone="muted">
              {t('auth.haveAccount')}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text variant="label" tone="primary">
                {t('auth.login')}
              </Text>
            </Link>
          </View>
        ) : (
          <Badge label={t('auth.stepOf', { current: step + 1, total: TOTAL_STEPS })} className="self-center" />
        )}
      </View>
    </Screen>
  );
}
