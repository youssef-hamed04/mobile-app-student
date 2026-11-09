import { useQuery } from '@tanstack/react-query';
import { Redirect, Tabs } from 'expo-router';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { qk } from '@/api/query-keys';
import { CountBadge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { registerPushToken, setBadgeCount } from '@/services/notifications';
import { useLanguageStore } from '@/store/language-store';
import { strokeWidth } from '@/theme/tokens';

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
  const insets = useSafeAreaInsets();
  const isRTL = useLanguageStore((s) => s.isRTL);

  const unread = useQuery({
    queryKey: qk.notifications.unread(),
    queryFn: () => api.get<{ count: number }>(Endpoints.notifications.unreadCount),
    enabled: status === 'authenticated',
    /*
     * Three minutes, not one.
     *
     * A badge count is not time-critical: a push notification already wakes
     * the app for anything that actually matters, and this poll exists to
     * catch the rest. At 60 seconds every signed-in student generated 1,440
     * requests a day whether or not they touched the app — all of which pass
     * through the Redis-backed rate limiter, on a plan billed per Redis
     * request. Multiply by the user base and this single line was the largest
     * client-side contributor to the quota.
     *
     * `refetchIntervalInBackground: false` is the library default and is
     * stated explicitly because it is load-bearing: `bootstrapQueryManagers`
     * wires `focusManager` to React Native's AppState, so a backgrounded app
     * stops polling entirely. Without that wiring this timer would keep
     * running in the background and the interval above would be beside the
     * point.
     *
     * `staleTime` matches the interval so returning to the app does not fire a
     * second, redundant fetch on top of the scheduled one — the two used to
     * compound, giving roughly double the intended rate for anyone who
     * switches apps often.
     */
    refetchInterval: 180_000,
    refetchIntervalInBackground: false,
    staleTime: 180_000,
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
          // A defined rule rather than a hairline: the tab bar reads as a
          // separate plate sitting on the page, matching the card treatment.
          borderTopColor: colors.border,
          borderTopWidth: strokeWidth.rule,
          // Android draws edge to edge, so the bar has to clear the system
          // navigation itself. Without the inset, three-button navigation covers
          // the labels and takes taps meant for the tabs, sending the student
          // Back or Home instead.
          height: Platform.OS === 'ios' ? 88 : 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10 + insets.bottom,
        },
        // The app's own faces (the bar is native, outside the Text primitive),
        // no synthetic bold, and no letter-spacing, which breaks Arabic joins.
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: isRTL ? 'Cairo-SemiBold' : 'Inter-SemiBold',
        },
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
