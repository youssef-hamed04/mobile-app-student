import * as React from 'react';
import { Alert, View } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { Card, CardBody } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { env } from '@/config/env';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';

/**
 * Password help.
 *
 * Students cannot change or recover their own password — a product decision:
 * the administration verifies the student and sets a new one. So this
 * screen's whole job is to route the student to a human as directly as
 * possible, with the information the administrator will ask for already
 * visible. No OTP flow is offered or implied.
 *
 * The contacts are build-time config. A release build cannot ship without
 * real values (app.config.ts refuses the placeholders), and a channel this
 * device cannot open says so instead of failing silently.
 */
export default function PasswordHelpScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const reach = async (attempt: Promise<boolean>) => {
    if (!(await attempt)) {
      Alert.alert(t('auth.passwordHelpTitle'), t('auth.supportOpenFailed'));
    }
  };

  return (
    <Screen edges={['top', 'bottom']} padded={false}>
      <AppBar title={t('auth.passwordHelpTitle')} />

      <Screen padded hideNetworkBanner edges={[]} contentClassName="pt-5">
        <Card className="border-primary/30 bg-primary-soft">
          <CardBody className="flex-row gap-3">
            <Icon name="shield" size={22} color={colors.primary} />
            <View className="flex-1">
              <Text variant="label" tone="primary">
                {t('auth.passwordHelpTitle')}
              </Text>
              <Text variant="caption" tone="muted" className="mt-1.5">
                {t('auth.passwordHelpBody')}
              </Text>
            </View>
          </CardBody>
        </Card>

        <View className="mt-5">
          <ListSection title={t('auth.contactAdmin')} footer={t('auth.passwordHelpNote')}>
            <ListItem
              icon="whatsapp"
              iconTone="primary"
              title={t('auth.whatsappSupport')}
              subtitle={env.support.whatsapp}
              showChevron
              onPress={() => void reach(support.whatsapp({ reason: 'password' }))}
            />
            <ListItem
              icon="phone"
              title={t('auth.callSupport')}
              subtitle={env.support.phone}
              showChevron
              onPress={() => void reach(support.call())}
            />
            <ListItem
              icon="mail"
              title={t('auth.emailSupport')}
              subtitle={env.support.email}
              showChevron
              onPress={() => void reach(support.email({ reason: 'password' }))}
            />
          </ListSection>
        </View>
      </Screen>
    </Screen>
  );
}
