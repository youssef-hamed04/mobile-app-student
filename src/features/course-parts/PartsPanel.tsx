import * as React from 'react';
import { View } from 'react-native';

import { SectionHeader } from '@/components/layout/SectionHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { InlineError } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/use-translation';
import type { CoursePart } from '@/types/domain';
import { formatMoney, localizedName } from '@/utils/format';

import { useCourseParts } from './hooks';

/**
 * The parts of a course, and what the student holds.
 *
 * Rendered inside the course screen rather than on a page of its own, because
 * "which half of this course do I own" is a question about the course and
 * answering it elsewhere would mean navigating away to find out.
 *
 * Three things this panel deliberately does NOT do:
 *
 *  - It offers no purchase button. Parts are unlocked by redeeming a
 *    part-scoped access card, bought offline, through the course's existing
 *    redemption flow. There is no purchase endpoint to call.
 *  - It never mentions wallet credit. A course does not debit the wallet, and
 *    putting a balance anywhere near this panel would invite the reader to
 *    believe otherwise.
 *  - It renders nothing at all when the course is sold whole. `hasParts:
 *    false` is a legitimate answer, and an empty "Parts" heading would read as
 *    something having failed to load.
 */
export function PartsPanel({
  courseId,
  onRedeem,
}: {
  courseId: string;
  /** Opens the same redemption sheet the course header uses. */
  onRedeem: () => void;
}) {
  const { t } = useTranslation();
  const query = useCourseParts(courseId);

  if (query.isLoading) {
    return (
      <View className="mt-6 gap-3">
        <Skeleton height={20} width="40%" />
        <Skeleton height={86} rounded="lg" />
        <Skeleton height={86} rounded="lg" />
      </View>
    );
  }

  // A failure here must not take the course screen with it: the description,
  // the sections and the player are all still usable without the parts panel.
  if (query.isError) {
    return (
      <View className="mt-6">
        <SectionHeader title={t('parts.title')} />
        <InlineError error={query.error} />
      </View>
    );
  }

  const data = query.data;
  if (!data?.hasParts || data.parts.length === 0) return null;

  return (
    <View className="mt-6">
      <SectionHeader
        title={t('parts.title')}
        subtitle={
          data.ownsAllParts ? t('parts.ownsAllSubtitle') : t('parts.subtitle')
        }
      />

      <View className="gap-3">
        {data.parts.map((part) => (
          <PartRow key={part.id} part={part} />
        ))}
      </View>

      {!data.ownsAllParts ? (
        <Card className="mt-3 border-primary/30 bg-primary-soft">
          <CardBody className="gap-2">
            <Text variant="label" tone="primary">
              {t('parts.howToUnlockTitle')}
            </Text>
            <Text variant="caption" tone="muted">
              {t('parts.howToUnlockBody')}
            </Text>
            <Button
              label={t('access.redeemCode')}
              variant="secondary"
              size="sm"
              iconStart="code"
              onPress={onRedeem}
              className="mt-1 self-start"
            />
          </CardBody>
        </Card>
      ) : null}
    </View>
  );
}

function PartRow({ part }: { part: CoursePart }) {
  const { t, language } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);

  const title = localizedName({ name: part.title, nameAr: part.titleAr }, language);
  const price =
    part.price === null
      ? null
      : formatMoney({ amount: part.price, currency: part.currency }, language);

  return (
    <Card>
      <CardBody className="gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text variant="label" numberOfLines={2}>
              {title}
            </Text>
            <Text variant="caption" tone="muted">
              {t('parts.sectionCount', { count: part.sectionCount })}
            </Text>
          </View>

          {part.owned ? (
            <Badge
              tone="success"
              icon="check"
              label={
                // Owning the whole course and owning this part separately are
                // different facts, and the student may need to tell them apart
                // when only one of them can expire.
                part.ownedVia === 'FULL_COURSE'
                  ? t('parts.ownedViaCourse')
                  : t('parts.owned')
              }
            />
          ) : (
            <View className="items-end gap-1">
              <Badge tone="neutral" icon="lock" label={t('parts.locked')} />
              {price ? (
                <Text variant="caption" tone="muted">
                  {price}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {part.sections.length > 0 ? (
          <>
            <Button
              label={expanded ? t('common.showLess') : t('parts.whatsInside')}
              variant="ghost"
              size="sm"
              iconEnd={expanded ? 'chevron-up' : 'chevron-down'}
              onPress={() => setExpanded((v) => !v)}
              className="self-start"
            />

            {expanded ? (
              <View className="gap-1.5 ps-1">
                {part.sections.map((section) => (
                  <View key={section.id} className="flex-row items-center gap-2">
                    <Icon
                      name={section.locked ? 'lock' : 'check'}
                      size={14}
                      // Titles are listed even when locked — that is what makes
                      // a part worth buying — but nothing here is playable.
                      color={undefined}
                    />
                    <Text
                      variant="caption"
                      tone={section.locked ? 'muted' : 'default'}
                      className="flex-1"
                      numberOfLines={1}
                    >
                      {localizedName(
                        { name: section.title, nameAr: section.titleAr },
                        language
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
