import * as React from 'react';
import { View } from 'react-native';

import { cn } from '@/utils/cn';

import { Text } from './Text';

export function Divider({ className }: { className?: string }) {
  return <View className={cn('h-px w-full bg-border', className)} />;
}

export function LabeledDivider({ label }: { label: string }) {
  return (
    <View className="my-4 flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border" />
      <Text variant="caption" tone="subtle">
        {label}
      </Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
