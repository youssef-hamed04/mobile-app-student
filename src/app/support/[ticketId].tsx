import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ErrorState, InlineError } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useReplyToTicket, useSupportTicket } from '@/features/support/hooks';
import { STATUS_TONE } from '@/features/support/status';
import { useTranslation } from '@/hooks/use-translation';
import type { SupportMessage } from '@/types/domain';
import { formatDateTime } from '@/utils/format';

/**
 * One support thread.
 *
 * A closed ticket is read-only — the server refuses a reply to it, and offering
 * a composer that is guaranteed to fail would be worse than explaining why it
 * is absent. Internal staff notes never reach this screen: the server filters
 * them out of the student's view rather than the client hiding them, so they
 * are not merely invisible, they are not sent.
 */
export default function SupportTicketScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const { t } = useTranslation();

  const query = useSupportTicket(ticketId);
  const reply = useReplyToTicket(ticketId ?? '');

  const [body, setBody] = React.useState('');
  const canSend = body.trim().length >= 1 && !reply.isPending;

  const send = async () => {
    if (!canSend) return;
    await reply.mutateAsync(body.trim());
    setBody('');
  };

  if (query.isLoading) {
    return (
      <Screen edges={['top', 'bottom']} padded={false}>
        <AppBar showBack />
        <Spinner fullscreen />
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen edges={['top', 'bottom']} padded={false}>
        <AppBar showBack />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const ticket = query.data;
  const closed = ticket.status === 'CLOSED';

  return (
    <Screen edges={['top']} padded={false} scroll keyboardAvoiding>
      <AppBar title={ticket.reference} subtitle={ticket.subject} showBack />

      <View className="gap-3 px-4 pb-10 pt-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge
            tone={STATUS_TONE[ticket.status]}
            label={t(`support.status.${ticket.status}`)}
          />
          <Badge tone="neutral" label={t(`support.categories.${ticket.category}`)} />
        </View>

        {ticket.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {closed ? (
          <Card>
            <CardBody>
              <Text variant="caption" tone="muted">
                {t('support.closedBody')}
              </Text>
            </CardBody>
          </Card>
        ) : (
          <View className="mt-2 gap-3">
            <Input
              label={t('support.reply')}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
              maxLength={4000}
              textAlignVertical="top"
              style={{ minHeight: 96 }}
            />

            {reply.isError ? <InlineError error={reply.error} /> : null}

            <Button
              label={t('support.send')}
              iconStart="send"
              loading={reply.isPending}
              disabled={!canSend}
              onPress={() => void send()}
              fullWidth
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const { t, language } = useTranslation();
  const mine = message.authorRole === 'STUDENT';

  return (
    <Card
      className={
        mine ? 'ms-8 border-primary/30 bg-primary-soft' : 'me-8 bg-surface-alt'
      }
    >
      <CardBody className="gap-1.5">
        <Text variant="caption" tone={mine ? 'primary' : 'muted'}>
          {mine ? t('support.you') : (message.author?.fullName ?? t('support.staff'))}
        </Text>
        <Text variant="body">{message.body}</Text>
        <Text variant="caption" tone="subtle">
          {formatDateTime(message.createdAt, language)}
        </Text>
      </CardBody>
    </Card>
  );
}
