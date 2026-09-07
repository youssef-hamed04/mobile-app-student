import * as React from 'react';
import { ScrollView, View } from 'react-native';

import { isDev } from '@/config/env';
import { createLogger } from '@/services/logger';

import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';

const log = createLogger('error-boundary');

interface Props {
  children: React.ReactNode;
  /** Rendered instead of the default fallback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Remounts the subtree when any of these change. */
  resetKeys?: unknown[];
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so a bad response payload takes down one screen
 * instead of the whole app.
 *
 * Deliberately *not* localized through the i18n hook: if i18n itself is what
 * crashed, calling into it here would loop. The strings are the one place in
 * the app where English is hardcoded, and they are paired with an icon so the
 * meaning survives without reading.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    log.error('render crash', {
      message: error.message,
      stack: error.stack?.slice(0, 800),
      componentStack: info.componentStack?.slice(0, 800),
    });
  }

  override componentDidUpdate(prev: Props) {
    if (
      this.state.error &&
      prev.resetKeys &&
      this.props.resetKeys &&
      prev.resetKeys.some((k, i) => k !== this.props.resetKeys?.[i])
    ) {
      this.reset();
    }
  }

  reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
          <Icon name="error" size={30} />
        </View>

        <Text variant="h3" className="text-center">
          Something went wrong
        </Text>
        <Text variant="caption" tone="muted" className="mt-2 max-w-[320px] text-center">
          This screen was stopped to keep your data safe. You can try again.
        </Text>

        {isDev ? (
          <ScrollView className="mt-4 max-h-48 w-full rounded-md bg-surface-alt p-3">
            <Text variant="caption" tone="subtle" forceLatin>
              {error.message}
              {'\n\n'}
              {error.stack}
            </Text>
          </ScrollView>
        ) : null}

        <Button label="Try again" onPress={this.reset} className="mt-6" />
      </View>
    );
  }
}
