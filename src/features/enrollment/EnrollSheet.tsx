import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { asApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { accessCodeSchema } from '@/features/auth/schemas';
import { useEnroll, useRedeemCode } from '@/features/courses/hooks';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { CourseDetail, EnrollmentMethod } from '@/types/domain';
import { formatMoney } from '@/utils/format';
import { cn } from '@/utils/cn';

const METHOD_META: Record<
  EnrollmentMethod,
  { icon: IconName; titleKey: string; bodyKey: string }
> = {
  FREE: { icon: 'checkCircle', titleKey: 'access.methodFree', bodyKey: 'access.methodFreeBody' },
  PAYMENT: { icon: 'price', titleKey: 'access.methodPayment', bodyKey: 'access.methodPaymentBody' },
  CODE: { icon: 'code', titleKey: 'access.methodCode', bodyKey: 'access.methodCodeBody' },
  ADMIN_APPROVAL: {
    icon: 'shield',
    titleKey: 'access.methodApproval',
    bodyKey: 'access.methodApprovalBody',
  },
};

export interface EnrollSheetProps {
  course: CourseDetail;
  visible: boolean;
  onClose: () => void;
}

/**
 * Join / enroll flow.
 *
 * Browsing and joining are separate states by design (spec §23): opening a
 * course never grants access. This sheet is the only path from
 * NOT_ENROLLED to anything else, and it renders exactly the methods the
 * backend says are available for this course — it never invents a payment
 * option or assumes a course is free.
 */
export function EnrollSheet({ course, visible, onClose }: EnrollSheetProps) {
  const { t, language } = useTranslation();
  const { colors } = useTheme();

  const methods = course.access.availableMethods;
  const [selected, setSelected] = React.useState<EnrollmentMethod | null>(
    methods.length === 1 ? (methods[0] ?? null) : null
  );

  const enroll = useEnroll(course.id);
  const redeem = useRedeemCode(course.id);
  const { translate, applyServerErrors } = useFormErrors<{ code: string }>();

  const codeForm = useForm<{ code: string }>({
    resolver: zodResolver(accessCodeSchema),
    defaultValues: { code: '' },
  });

  React.useEffect(() => {
    if (!visible) {
      setSelected(methods.length === 1 ? (methods[0] ?? null) : null);
      codeForm.reset();
      enroll.reset();
      redeem.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const price = formatMoney(course.price, language);
  const busy = enroll.isPending || redeem.isPending;

  const submitCode = codeForm.handleSubmit(async ({ code }) => {
    try {
      await redeem.mutateAsync(code.trim().toUpperCase());
      onClose();
    } catch (e) {
      const remaining = applyServerErrors(e, codeForm.setError);
      if (remaining) {
        codeForm.setError('code', { message: remaining.i18nKey });
      }
    }
  });

  const submitMethod = async () => {
    if (!selected) return;

    if (selected === 'CODE') {
      await submitCode();
      return;
    }

    try {
      const result = await enroll.mutateAsync(selected);

      // A payment provider returns an external checkout URL. We hand off to
      // the browser rather than embedding a WebView so the student sees the
      // provider's own TLS indicator — and so no card data ever touches
      // this app.
      if (result.payment?.checkoutUrl) {
        await Linking.openURL(result.payment.checkoutUrl);
      }
      onClose();
    } catch {
      // Error is rendered from the mutation state below.
    }
  };

  const activeError = redeem.error ?? enroll.error;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('access.chooseMethod')}
      subtitle={course.title}
    >
      <View className="gap-2 pb-2">
        {methods.length === 0 ? (
          <Text variant="caption" tone="muted" className="py-6 text-center">
            {t('errors.COURSE_NOT_AVAILABLE')}
          </Text>
        ) : null}

        {methods.map((method) => {
          const meta = METHOD_META[method];
          const active = selected === method;

          return (
            <Pressable
              key={method}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(meta.titleKey)}
              onPress={() => setSelected(method)}
              className={cn(
                'flex-row items-center gap-3 rounded-md border p-3.5',
                active
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface active:bg-surface-alt'
              )}
              style={{ minHeight: MIN_TOUCH_TARGET }}
            >
              <View
                className={cn(
                  'h-10 w-10 items-center justify-center rounded-md',
                  active ? 'bg-primary' : 'bg-surface-alt'
                )}
              >
                <Icon
                  name={meta.icon}
                  size={18}
                  color={active ? colors.primaryFg : colors.muted}
                />
              </View>

              <View className="flex-1">
                <Text variant="label" tone={active ? 'primary' : 'default'}>
                  {t(meta.titleKey)}
                  {method === 'PAYMENT' && price ? ` · ${price}` : ''}
                </Text>
                <Text variant="caption" tone="muted" className="mt-0.5">
                  {t(meta.bodyKey)}
                </Text>
              </View>

              {active ? <Icon name="check" size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        })}

        {selected === 'CODE' ? (
          <View className="mt-2">
            <Controller
              control={codeForm.control}
              name="code"
              render={({ field }) => (
                <Input
                  label={t('access.codeLabel')}
                  placeholder={t('access.codePlaceholder')}
                  value={field.value}
                  onChangeText={(v) => field.onChange(v.toUpperCase())}
                  error={translate(codeForm.formState.errors.code?.message)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  iconStart="code"
                  forceLTR
                  returnKeyType="go"
                  onSubmitEditing={submitCode}
                />
              )}
            />
          </View>
        ) : null}

        {activeError ? (
          <View className="mt-2">
            <InlineError error={asApiError(activeError)} />
          </View>
        ) : null}

        <Button
          label={
            busy
              ? selected === 'CODE'
                ? t('access.redeeming')
                : t('access.joining')
              : selected === 'CODE'
                ? t('access.redeem')
                : t('access.joinNow')
          }
          onPress={submitMethod}
          loading={busy}
          disabled={!selected}
          size="lg"
          fullWidth
          className="mt-3"
        />
      </View>
    </Sheet>
  );
}
