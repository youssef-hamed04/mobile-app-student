import * as React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { cn } from '@/utils/cn';

import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Spinner } from './Spinner';
import { Text } from './Text';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string> {
  label?: string;
  placeholder?: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Message shown inside the sheet when there are no options yet. */
  emptyMessage?: string;
  containerClassName?: string;
  /** See `Input.onPlate` — same treatment, so the two line up in a form. */
  onPlate?: boolean;
}

/**
 * Sheet-based picker.
 *
 * A native picker was rejected because it can't render the Arabic labels with
 * the app's font, and because option lists here are dependent (faculty depends
 * on university) and need an inline loading + empty state.
 */
export function Select<T extends string>({
  label,
  placeholder,
  value,
  options,
  onChange,
  error,
  hint,
  required,
  disabled,
  loading,
  emptyMessage,
  containerClassName,
  onPlate = false,
}: SelectProps<T>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = React.useState(false);

  const selected = options.find((o) => o.value === value) ?? null;
  const isDisabled = disabled || loading;

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? (
        <View className="flex-row items-center gap-1">
          <Text
            variant="label"
            tone={error ? 'accent' : onPlate ? 'onHighlight' : 'default'}
          >
            {label}
          </Text>
          {required ? (
            <Text
              variant="label"
              tone={onPlate ? 'onHighlight' : 'accent'}
              accessibilityElementsHidden
            >
              *
            </Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? t('common.select')}
        accessibilityValue={{ text: selected?.label ?? placeholder ?? '' }}
        accessibilityState={{ disabled: !!isDisabled, expanded: open }}
        disabled={isDisabled}
        onPress={() => setOpen(true)}
        className={cn(
          'flex-row items-center gap-2 rounded-md border bg-surface px-3',
          onPlate && 'border-2',
          error ? 'border-accent' : onPlate ? 'border-outline' : 'border-border',
          isDisabled && 'bg-surface-alt opacity-70'
        )}
        style={{ minHeight: MIN_TOUCH_TARGET + 4 }}
      >
        <Text
          variant="body"
          tone={selected ? 'default' : 'subtle'}
          className="flex-1"
          numberOfLines={1}
        >
          {selected?.label ?? placeholder ?? t('common.select')}
        </Text>

        {loading ? (
          <Spinner size="small" />
        ) : (
          <Icon name="chevron-down" size={18} color={colors.muted} />
        )}
      </Pressable>

      {error ? (
        <Text variant="caption" tone="accent">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.length === 0 ? (
          <View className="py-8">
            <Text variant="caption" tone="muted" className="text-center">
              {emptyMessage ?? t('common.notSet')}
            </Text>
          </View>
        ) : (
          options.map((opt) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: !!opt.disabled }}
                disabled={opt.disabled}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex-row items-center gap-3 rounded-md px-3 py-3.5 active:bg-surface-alt',
                  opt.disabled && 'opacity-40'
                )}
                style={{ minHeight: MIN_TOUCH_TARGET }}
              >
                <View className="flex-1">
                  <Text variant="body" tone={active ? 'primary' : 'default'}>
                    {opt.label}
                  </Text>
                  {opt.description ? (
                    <Text variant="caption" tone="muted" className="mt-0.5">
                      {opt.description}
                    </Text>
                  ) : null}
                </View>
                {active ? <Icon name="check" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })
        )}
      </Sheet>
    </View>
  );
}
