import { useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { toast } from '@/store/ui-store';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { Attachment, AttachmentKind } from '@/types/domain';
import { formatBytes } from '@/utils/format';

const KIND_ICON: Record<AttachmentKind, IconName> = {
  PDF: 'pdf',
  IMAGE: 'camera',
  DOC: 'document',
  SHEET: 'progress',
  LINK: 'external',
  OTHER: 'document',
};

export interface AttachmentRowProps {
  attachment: Attachment;
  locked?: boolean;
}

/**
 * Course / lesson material.
 *
 * Protected attachments open in the in-app secure viewer, which applies the
 * same screenshot protection and watermark as video. There is deliberately no
 * download affordance for them — only attachments the backend explicitly
 * marks `downloadable` get an open-externally action.
 */
export function AttachmentRow({ attachment, locked }: AttachmentRowProps) {
  const { t, language } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const open = () => {
    if (locked || attachment.locked) {
      toast.info(t('access.lockedBody'));
      return;
    }
    router.push(`/viewer/${attachment.id}`);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={attachment.title}
      accessibilityState={{ disabled: !!locked }}
      onPress={open}
      className="flex-row items-center gap-3 bg-surface px-3 py-3 active:bg-surface-alt"
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <View className="h-10 w-10 items-center justify-center rounded-md bg-surface-alt">
        <Icon
          name={KIND_ICON[attachment.kind]}
          size={18}
          color={locked ? colors.subtle : colors.primary}
        />
      </View>

      <View className="flex-1">
        <Text variant="body" tone={locked ? 'subtle' : 'default'} numberOfLines={2}>
          {attachment.title}
        </Text>

        <View className="mt-0.5 flex-row items-center gap-2">
          <Text variant="caption" tone="subtle" forceLatin>
            {attachment.kind}
          </Text>
          {attachment.sizeBytes ? (
            <Text variant="caption" tone="subtle" forceLatin>
              · {formatBytes(attachment.sizeBytes, language)}
            </Text>
          ) : null}
          {attachment.pageCount ? (
            <Text variant="caption" tone="subtle" forceLatin>
              · {attachment.pageCount}p
            </Text>
          ) : null}
        </View>
      </View>

      {attachment.protected ? (
        <Badge label={t('security.protectedContentTitle')} icon="shield" tone="primary" />
      ) : null}

      {locked ? <Icon name="lock" size={16} color={colors.subtle} /> : null}
    </Pressable>
  );
}
