import { useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { env } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';
import { formatDate, localizedName, maskPhone } from '@/utils/format';

export default function ProfileScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert(t('auth.logoutConfirmTitle'), t('auth.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);
  };

  if (!user) return null;

  const statusTone =
    user.status === 'ACTIVE'
      ? 'success'
      : user.status === 'PENDING'
        ? 'warning'
        : 'danger';

  return (
    <Screen contentClassName="pt-2">
      <View className="mb-6 items-center">
        <Avatar name={user.fullName} uri={user.avatarUrl} size={88} />
        <Text variant="h3" className="mt-3 text-center">
          {user.fullName}
        </Text>
        <Text variant="caption" tone="muted" className="mt-1" forceLatin>
          {maskPhone(user.phone)}
        </Text>
        <Badge
          label={t(`profile.status.${user.status}`)}
          tone={statusTone}
          className="mt-2"
        />
      </View>

      <ListSection title={t('profile.academicInfo')}>
        <ListItem
          icon="school"
          title={t('auth.university')}
          value={localizedName(user.university, language)}
        />
        <ListItem
          icon="courses"
          title={t('auth.faculty')}
          value={localizedName(user.faculty, language)}
        />
        <ListItem
          icon="document"
          title={t('auth.department')}
          value={localizedName(user.department, language)}
        />
        <ListItem
          icon="calendar"
          title={t('auth.academicYear')}
          value={localizedName(user.academicYear, language)}
        />
      </ListSection>

      <ListSection
        title={t('profile.accountInfo')}
        footer={t('profile.memberSince', { date: formatDate(user.createdAt, language) })}
      >
        <ListItem
          icon="edit"
          title={t('profile.editProfile')}
          showChevron
          onPress={() => router.push('/profile/edit')}
        />
        <ListItem
          icon="lock"
          title={t('profile.changePassword')}
          showChevron
          onPress={() =>
            void support.whatsapp({
              reason: 'password',
              fullName: user.fullName,
              phone: user.phone,
            })
          }
        />
        <ListItem
          icon="device"
          title={t('settings.authorizedDevice')}
          subtitle={t('settings.deviceBody')}
          showChevron
          onPress={() => router.push('/settings/devices')}
        />
      </ListSection>

      <ListSection title={t('settings.title')}>
        <ListItem
          icon="settings"
          title={t('settings.title')}
          showChevron
          onPress={() => router.push('/settings')}
        />
        <ListItem
          icon="shield"
          title={t('security.title')}
          showChevron
          onPress={() => router.push('/settings/security')}
        />
        <ListItem
          icon="help"
          title={t('settings.contactSupport')}
          showChevron
          onPress={() =>
            void support.whatsapp({
              reason: 'general',
              fullName: user.fullName,
              phone: user.phone,
            })
          }
        />
      </ListSection>

      <ListSection footer={t('settings.version', { version: env.appVersion })}>
        <ListItem
          icon="logout"
          title={t('auth.logout')}
          destructive
          onPress={confirmLogout}
        />
      </ListSection>
    </Screen>
  );
}
