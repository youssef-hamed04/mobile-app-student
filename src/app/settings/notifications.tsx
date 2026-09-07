import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { qk } from '@/api/query-keys';
import { AppBar } from '@/components/layout/AppBar';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/hooks/use-translation';
import {
  getPermissionStatus,
  registerPushToken,
  requestPermission,
} from '@/services/notifications';
import { support } from '@/services/support';

interface Preferences {
  newCourse: boolean;
  newLesson: boolean;
  announcements: boolean;
  payments: boolean;
}

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [permission, setPermission] = React.useState<string | null>(null);

  React.useEffect(() => {
    void getPermissionStatus().then(setPermission);
  }, []);

  const prefs = useQuery({
    queryKey: qk.notifications.preferences(),
    queryFn: () => api.get<Preferences>(Endpoints.notifications.preferences),
  });

  const update = useMutation({
    mutationFn: (next: Preferences) =>
      api.put<Preferences>(Endpoints.notifications.preferences, next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications.preferences() });
      const previous = queryClient.getQueryData<Preferences>(
        qk.notifications.preferences()
      );
      queryClient.setQueryData(qk.notifications.preferences(), next);
      return { previous };
    },
    onError: (_e, _next, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(qk.notifications.preferences(), ctx.previous);
      }
    },
  });

  const value = prefs.data;
  const granted = permission === 'granted';

  const set = (key: keyof Preferences) => (on: boolean) => {
    if (!value) return;
    update.mutate({ ...value, [key]: on });
  };

  const togglePush = async (on: boolean) => {
    if (!on) {
      void support.openSettings();
      return;
    }
    const outcome = await requestPermission();
    setPermission(outcome);
    if (outcome === 'granted') await registerPushToken();
    else void support.openSettings();
  };

  return (
    <Screen padded={false} edges={['top']}>
      <AppBar title={t('settings.notifications')} />

      <Screen hideNetworkBanner edges={[]} contentClassName="pt-4">
        <ListSection
          footer={granted ? undefined : t('notifications.blockedBody')}
        >
          <ListItem
            icon="bellOutline"
            title={t('settings.pushNotifications')}
            toggle={{ value: granted, onChange: (v) => void togglePush(v) }}
          />
        </ListSection>

        {prefs.isLoading ? (
          <Spinner />
        ) : value ? (
          <ListSection title={t('settings.notifications')}>
            <ListItem
              icon="play"
              title={t('settings.notifyNewLesson')}
              toggle={{
                value: value.newLesson,
                onChange: set('newLesson'),
                disabled: !granted,
              }}
            />
            <ListItem
              icon="school"
              title={t('settings.notifyNewCourse')}
              toggle={{
                value: value.newCourse,
                onChange: set('newCourse'),
                disabled: !granted,
              }}
            />
            <ListItem
              icon="info"
              title={t('settings.notifyAnnouncements')}
              toggle={{
                value: value.announcements,
                onChange: set('announcements'),
                disabled: !granted,
              }}
            />
            <ListItem
              icon="price"
              title={t('settings.notifyPayments')}
              toggle={{
                value: value.payments,
                onChange: set('payments'),
                disabled: !granted,
              }}
            />
          </ListSection>
        ) : null}
      </Screen>
    </Screen>
  );
}
