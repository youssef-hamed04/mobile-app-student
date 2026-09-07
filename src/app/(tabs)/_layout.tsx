import { useQuery } from '@tanstack/react-query';
import { Redirect, Tabs } from 'expo-router';
import * as React from 'react';
import { Platform, View } from 'react-native';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { qk } from '@/api/query-keys';
import { CountBadge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { registerPushToken, setBadgeCount } from '@/services/notifications';

type TabName = 'index' | 'courses' | 'my-courses' | 'search' | 'notifications' | 'profile';

const ICONS: Record<TabName, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'homeOutline' },
  courses: { active: 'courses', inactive: 'coursesOutline' },
  'my-courses': { active: 'myCourses', inactive: 'myCoursesOutline' },
  search: { active: 'search', inactive: 'searchOutline' },
  notifications: { active: 'bell', inactive: 'bellOutline' },
  profile: { active: 'person', inactive: 'personOutline' },
};

export default function TabsLayout() {
  const { status } = useAuth();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const unread = useQuery({
    queryKey: qk.notifications.unread(),
    queryFn: () => api.get<{ count: number }>(Endpoints.notifications.unreadCount),
    enabled: status === 'authenticated',
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unreadCount = unread.data?.count ?? 0;

  // Keep the OS badge in sync with the in-app one.
  React.useEffect(() => {
    void setBadgeCount(unreadCount);
  }, [unreadCount]);

  // Register for push only once inside the authenticated shell — doing it at
  // app start would ask a signed-out student for permission with no context.
  React.useEffect(() => {
    if (status === 'authenticated') void registerPushToken();
  }, [status]);

  if (status === 'unauthenticated') return <Redirect href="/(auth)/login" />;

  const icon =
    (name: TabName) =>
    ({ focused, color }: { focused: boolean; color: any }) => (
      <View>
        <Icon
          name={focused ? ICONS[name].active : ICONS[name].inactive}
          size={23}
          color={color}
        />
        {name === 'notifications' && unreadCount > 0 ? (
          <View className="absolute -end-2 -top-1">
            <CountBadge
              count={unreadCount}
              label={t('a11y.unreadBadge', { count: unreadCount })}
            />
          </View>
        ) : null}
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        // The tab bar itself does not need manual RTL handling: the native
        // view tree is mirrored, so the order flips with the layout.
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: icon('index') }}
      />
      <Tabs.Screen
        name="courses"
        options={{ title: t('tabs.courses'), tabBarIcon: icon('courses') }}
      />
      <Tabs.Screen
        name="my-courses"
        options={{ title: t('tabs.myCourses'), tabBarIcon: icon('my-courses') }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: t('tabs.search'), tabBarIcon: icon('search') }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.notifications'),
          tabBarIcon: icon('notifications'),
          tabBarAccessibilityLabel:
            unreadCount > 0
              ? `${t('tabs.notifications')}, ${t('a11y.unreadBadge', { count: unreadCount })}`
              : t('tabs.notifications'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: icon('profile') }}
      />
    </Tabs>
  );
}
