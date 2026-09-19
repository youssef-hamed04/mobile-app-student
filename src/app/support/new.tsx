import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { useCreateTicket } from '@/features/support/hooks';
import { useTranslation } from '@/hooks/use-translation';
import type { SupportTicketCategory } from '@/types/domain';

const CATEGORIES: SupportTicketCategory[] = [
  'GENERAL',
  'TECHNICAL',
  'PAYMENT',
  'ACCESS',
  'CONTENT',
  'OTHER',
];

/**
 * Opening a ticket.
 *
 * The limits mirror the server's DTO exactly — subject 3–200, body 3–4000 —
 * so a message that would be refused is caught before it costs a round trip,
 * and one the app accepts is one the server accepts too.
 *
 * `courseId` can arrive as a route parameter, which is how "report a problem
 * with this course" can reach here with the context already attached rather
 * than asking the student to describe which course they mean.
 */
export default function NewTicketScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();

  const create = useCreateTicket();

  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [category, setCategory] = React.useState<SupportTicketCategory>('GENERAL');

  const subjectValid = subject.trim().length >= 3 && subject.trim().length <= 200;
  const bodyValid = body.trim().length >= 3 && body.trim().length <= 4000;
  const canSubmit = subjectValid && bodyValid && !create.isPending;

  const submit = async () => {
    if (!canSubmit) return;

    const ticket = await create.mutateAsync({
      subject: subject.trim(),
      body: body.trim(),
      category,
      courseId: courseId || undefined,
    });

    // Replace rather than push: going "back" from the thread should return to
    // the ticket list, not to a form that has already been submitted.
    router.replace(`/support/${ticket.id}`);
  };

  return (
    <Screen edges={['top']} padded={false} scroll keyboardAvoiding>
      <AppBar title={t('support.newTicket')} showBack />

      <View className="gap-4 px-4 pb-10 pt-3">
        <Input
          label={t('support.subject')}
          value={subject}
          onChangeText={setSubject}
          maxLength={200}
          required
          error={
            subject.length > 0 && !subjectValid ? t('support.subjectError') : undefined
          }
        />

        <Select<SupportTicketCategory>
          label={t('support.category')}
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((value) => ({
            value,
            label: t(`support.categories.${value}`),
          }))}
        />

        <Input
          label={t('support.message')}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={7}
          maxLength={4000}
          required
          textAlignVertical="top"
          style={{ minHeight: 140 }}
          error={body.length > 0 && !bodyValid ? t('support.messageError') : undefined}
          hint={t('support.messageHint')}
        />

        {create.isError ? <InlineError error={create.error} /> : null}

        <Button
          label={t('support.send')}
          iconStart="send"
          loading={create.isPending}
          disabled={!canSubmit}
          onPress={() => void submit()}
          fullWidth
        />

        <Text variant="caption" tone="muted">
          {t('support.responseTimeNote')}
        </Text>
      </View>
    </Screen>
  );
}
