import * as React from 'react';
import { View } from 'react-native';

import { asApiError } from '@/api/errors';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useCourseJoinOptions } from '@/features/course-parts/hooks';
import { useEnroll, useRedeemCode } from '@/features/courses/hooks';
import { useTranslation } from '@/hooks/use-translation';
import type { CoursePart } from '@/types/domain';
import { formatMoney, localizedName } from '@/utils/format';

/**
 * JOIN.
 *
 * One sheet that answers the two questions a student actually has: what are my
 * options, and how do I get in.
 *
 * The options half is a comparison, not a checkout. A course can be bought
 * whole or one part at a time, and the whole-course price is usually the
 * better deal — so both are shown together with their prices, because showing
 * only the parts would push students to the more expensive path by omission.
 * What the student already owns is marked rather than hidden, so they can see
 * they hold part 1 and what part 2 would add.
 *
 * The "how" half is deliberately NOT a purchase flow, because the platform
 * does not have one. An access card is scoped when an administrator generates
 * it — whole course, part, or section — and the money changes hands offline.
 * The student's move is to obtain the right card and redeem it, so the sheet
 * names which card to ask for and then takes the code. Inventing a checkout
 * here would be a button that leads nowhere.
 *
 * `methods` comes from the server and is rendered as given. `wallet` is always
 * false — the wallet belongs to the Library and a course never debits it — and
 * `onlinePayment` follows the configured provider, which currently ships
 * disabled. Nothing about online payment is drawn while the server says it is
 * unavailable, and nothing here has to know why.
 */
export function JoinSheet({
  courseId,
  visible,
  onClose,
}: {
  courseId: string;
  visible: boolean;
  onClose: () => void;
}) {
  // The body is remounted whenever the sheet opens, which is how the typed
  // code, the chosen option and any error get cleared.
  //
  // The alternative — an effect that resets state when `visible` turns false —
  // is what the older sheet beside this one does, and it is a lint error for a
  // real reason: setting state synchronously inside an effect schedules a
  // second render pass every time the sheet closes. A key costs nothing and
  // cannot go stale.
  return (
    <JoinSheetBody
      key={visible ? 'open' : 'closed'}
      courseId={courseId}
      visible={visible}
      onClose={onClose}
    />
  );
}

function JoinSheetBody({
  courseId,
  visible,
  onClose,
}: {
  courseId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t, language } = useTranslation();
  const options = useCourseJoinOptions(courseId, visible);
  const redeem = useRedeemCode(courseId);
  const enroll = useEnroll(courseId);

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  /** Which option the student says they are buying, for the hint text only. */
  const [intent, setIntent] = React.useState<'FULL' | string | null>(null);

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length === 0) {
      setError(t('access.codeRequired'));
      return;
    }

    setError(null);
    try {
      await redeem.mutateAsync(trimmed);
      onClose();
    } catch (e) {
      // The server's code decides the message, exactly as everywhere else —
      // an already-spent card and a card for another course are different
      // problems and must not read the same.
      setError(t(asApiError(e).i18nKey, { defaultValue: t('errors.genericBody') }));
    }
  };

  const data = options.data;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('access.joinTitle')}
      subtitle={
        data
          ? localizedName({ name: data.title, nameAr: data.titleAr }, language)
          : undefined
      }
      scrollable
    >
      {options.isLoading ? (
        <View className="items-center py-8">
          <Spinner label={t('common.loading')} />
        </View>
      ) : options.error ? (
        <ErrorState error={options.error} onRetry={() => void options.refetch()} compact />
      ) : !data ? null : (
        <View className="gap-4">
          <Text variant="caption" tone="muted">
            {t('access.joinIntro')}
          </Text>

          {/* The whole-course option. Always shown, even when the course has
              parts — it is usually cheaper than buying every part, and the
              student cannot weigh that if only one side is on screen. */}
          <OptionRow
            title={t('access.fullCourse')}
            subtitle={t('access.fullCourseBody')}
            price={
              data.fullCourse.isFree
                ? t('access.free')
                : data.fullCourse.price === null
                  ? null
                  : formatMoney(
                      { amount: data.fullCourse.price, currency: data.fullCourse.currency },
                      language,
                    )
            }
            owned={data.fullCourse.owned}
            selected={intent === 'FULL'}
            onSelect={() => setIntent('FULL')}
          />

          {data.hasParts ? (
            <View className="gap-2">
              <Text variant="label" tone="muted">
                {t('access.orOnePart')}
              </Text>
              {data.parts.map((part) => (
                <PartOption
                  key={part.id}
                  part={part}
                  selected={intent === part.id}
                  onSelect={() => setIntent(part.id)}
                />
              ))}
            </View>
          ) : null}

          {/* A free course, or one an administrator approves, joins without a
              card. Rendered only because the server listed the method — the
              sheet does not decide this from `isFree`, which describes the
              price rather than the mechanism. */}
          {data.enrollmentMethods.includes('FREE') && !data.fullCourse.owned ? (
            <Button
              label={t('access.joinFree')}
              loading={enroll.isPending}
              onPress={() => {
                void enroll
                  .mutateAsync('FREE')
                  .then(() => onClose())
                  .catch((e: unknown) => {
                    setError(
                      t(asApiError(e).i18nKey, { defaultValue: t('errors.genericBody') }),
                    );
                  });
              }}
            />
          ) : null}

          {data.enrollmentMethods.includes('ADMIN_APPROVAL') && !data.fullCourse.owned ? (
            <Button
              label={t('access.requestApproval')}
              variant="secondary"
              loading={enroll.isPending}
              onPress={() => {
                void enroll
                  .mutateAsync('ADMIN_APPROVAL')
                  .then(() => onClose())
                  .catch((e: unknown) => {
                    setError(
                      t(asApiError(e).i18nKey, { defaultValue: t('errors.genericBody') }),
                    );
                  });
              }}
            />
          ) : null}

          {/* How to get in. Only the mechanisms the server permits. */}
          {data.enrollmentMethods.includes('CODE') && data.methods.accessCode ? (
            <View className="gap-2 rounded-lg border border-border bg-surface-alt p-3">
              <View className="flex-row items-center gap-2">
                <Icon name="code" size={18} />
                <Text variant="label">{t('access.methodCode')}</Text>
              </View>

              <Text variant="caption" tone="muted">
                {intent === 'FULL'
                  ? t('access.cardHintFullCourse')
                  : intent
                    ? t('access.cardHintPart')
                    : t('access.cardHintGeneric')}
              </Text>

              <Input
                label={t('access.codeLabel')}
                value={code}
                onChangeText={(next) => {
                  setCode(next);
                  if (error) setError(null);
                }}
                error={error ?? undefined}
                autoCapitalize="characters"
                autoCorrect={false}
                forceLTR
                editable={!redeem.isPending}
              />

              <Button
                label={t('access.redeem')}
                onPress={() => void submit()}
                loading={redeem.isPending}
              />
            </View>
          ) : null}

          {/* Nothing renders for wallet or online payment. Both are absent
              from `methods` today, and the sheet asks the server rather than
              deciding for itself — so enabling a provider later needs no
              change here. */}
          {data.enrollmentMethods.length === 0 ? (
            <View className="rounded-lg border border-border p-3">
              <Text variant="caption" tone="muted">
                {t('access.noMethods')}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

function OptionRow({
  title,
  subtitle,
  price,
  owned,
  selected,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  price: string | null;
  owned: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View
      className={`gap-1 rounded-lg border p-3 ${
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="label" className="flex-1">
          {title}
        </Text>
        {owned ? (
          <Badge tone="success" icon="checkCircle" label={t('parts.owned')} />
        ) : price ? (
          <Text variant="label">{price}</Text>
        ) : null}
      </View>

      {subtitle ? (
        <Text variant="caption" tone="muted">
          {subtitle}
        </Text>
      ) : null}

      {owned ? null : (
        <Button
          label={selected ? t('access.selected') : t('access.chooseThis')}
          variant={selected ? 'primary' : 'secondary'}
          size="sm"
          onPress={onSelect}
        />
      )}
    </View>
  );
}

function PartOption({
  part,
  selected,
  onSelect,
}: {
  part: CoursePart;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, language } = useTranslation();

  return (
    <OptionRow
      title={localizedName({ name: part.title, nameAr: part.titleAr }, language)}
      subtitle={t('parts.sectionCount', { count: part.sectionCount })}
      price={
        part.price === null
          ? null
          : formatMoney({ amount: part.price, currency: part.currency }, language)
      }
      owned={part.owned}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
