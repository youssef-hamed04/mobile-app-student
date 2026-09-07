import { Image } from 'expo-image';
import * as React from 'react';
import { View } from 'react-native';

import { initials } from '@/utils/format';
import { cn } from '@/utils/cn';

import { Text } from './Text';

export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, uri, size = 44, className }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const showImage = !!uri && !failed;

  return (
    <View
      accessibilityLabel={name}
      className={cn(
        'items-center justify-center overflow-hidden rounded-full bg-primary-soft',
        className
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          variant="label"
          className="text-primary"
          forceLatin
          style={{ fontSize: Math.max(11, size * 0.36) }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
