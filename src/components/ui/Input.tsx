import * as React from 'react';
import {
  Pressable,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useLanguageStore } from '@/store/language-store';
import { brand } from '@/theme/palette';
import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  error?: string;
  hint?: string;
  iconStart?: IconName;
  /** Renders a trailing affordance (clear, reveal, unit…). */
  iconEnd?: IconName;
  onPressIconEnd?: () => void;
  iconEndAccessibilityLabel?: string;
  required?: boolean;
  containerClassName?: string;
  /**
   * Renders the field for a brand-plate ground (the auth screens). A white
   * field on the plate is only 1.8:1, so the edge comes from the near-black
   * rule instead of the usual hairline, and the label is inked to match.
   */
  onPlate?: boolean;
  /**
   * Latin-only fields (phone, codes) stay LTR even in an Arabic UI, because
   * a phone number rendered RTL is unreadable.
   */
  forceLTR?: boolean;
}

/**
 * Text field.
 *
 * Notable behaviours:
 *  - the error message is wired to `accessibilityLabel` on the input so
 *    screen readers announce the field *and* why it failed
 *  - focus state uses a 2px primary ring, which is the same affordance used
 *    for keyboard focus on the future web dashboard
 *  - the container, not the TextInput, owns the border, so the 48dp target is
 *    preserved even when the font scales up.
 */
export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    hint,
    iconStart,
    iconEnd,
    onPressIconEnd,
    iconEndAccessibilityLabel,
    required,
    containerClassName,
    onPlate = false,
    forceLTR = false,
    editable = true,
    onFocus,
    onBlur,
    style,
    ...rest
  },
  ref
) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const isRTL = useLanguageStore((s) => s.isRTL);
  const [focused, setFocused] = React.useState(false);

  const describedBy = error ?? hint;

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? (
        // One text at the full row width. Sized to its content, an Arabic label
        // could measure a hair too narrow on Android, and its last word then
        // wrapped onto a second line that was never shown.
        <Text
          variant="label"
          // The accent red is too faint on the orange plate in either theme.
          tone={error ? (onPlate ? 'none' : 'accent') : onPlate ? 'onHighlight' : 'default'}
          className={error && onPlate ? 'text-danger-800' : undefined}
          accessibilityLabel={label}
        >
          {label}
          {required ? (
            <Text variant="label" tone={onPlate ? 'onHighlight' : 'accent'}>
              {' *'}
            </Text>
          ) : null}
        </Text>
      ) : null}

      <View
        className={cn(
          'min-h-[52px] flex-row items-center gap-2 rounded-md border bg-surface px-3',
          onPlate && 'border-2',
          error
            ? 'border-accent'
            : focused
              ? 'border-primary'
              : onPlate
                ? 'border-outline'
                : 'border-border',
          focused && !error && 'border-2',
          !editable && 'bg-surface-alt opacity-70'
        )}
      >
        {iconStart ? (
          <Icon
            name={iconStart}
            size={20}
            color={error ? colors.accent : focused ? colors.primary : colors.subtle}
          />
        ) : null}

        <TextInput
          ref={ref}
          editable={editable}
          // The app's own faces, so typed text and placeholders match the
          // labels around them instead of falling back to Roboto / SF.
          className={cn(
            'flex-1 py-3 text-base text-foreground',
            isRTL && !forceLTR ? 'font-arabic' : 'font-sans'
          )}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          // The keyboard is a native surface and follows the platform
          // appearance, which now tracks the app's resolved theme. Stating it
          // explicitly means a light keyboard never appears under a dark
          // field while the OS and the in-app preference disagree.
          keyboardAppearance={isDark ? 'dark' : 'light'}
          accessibilityLabel={label}
          accessibilityHint={describedBy}
          accessibilityState={{ disabled: !editable }}
          // The caller's style (a multiline minHeight, say) is merged after
          // the direction, not instead of it: a `style` prop used to replace
          // the writing direction and Arabic multiline fields went LTR.
          style={[
            forceLTR
              ? { writingDirection: 'ltr', textAlign: isRTL ? 'right' : 'left' }
              : { writingDirection: isRTL ? 'rtl' : 'ltr' },
            style,
          ]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {iconEnd ? (
          <Pressable
            onPress={onPressIconEnd}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={iconEndAccessibilityLabel ?? t('common.select')}
            disabled={!onPressIconEnd}
            // A full 48dp target on its own, inside the 52dp field.
            className="-me-2 items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Icon name={iconEnd} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View className="flex-row items-center gap-1">
          {/* On the plate the usual accent red is 2.8:1 — still red, but a
              deep enough one to be readable on orange. */}
          <Icon
            name="error"
            size={14}
            color={onPlate ? brand.redDeep : colors.accent}
          />
          <Text
            variant="caption"
            tone={onPlate ? 'none' : 'default'}
            className={cn('flex-1', onPlate ? 'text-danger-800' : 'text-accent')}
          >
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone={onPlate ? 'onHighlight' : 'subtle'}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/** Password field with a reveal toggle wired to the right a11y labels. */
export const PasswordInput = React.forwardRef<TextInput, InputProps>(
  function PasswordInput(props, ref) {
    const { t } = useTranslation();
    const [hidden, setHidden] = React.useState(true);

    return (
      <Input
        ref={ref}
        secureTextEntry={hidden}
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
        iconStart="lock"
        iconEnd={hidden ? 'eye' : 'eyeOff'}
        onPressIconEnd={() => setHidden((v) => !v)}
        iconEndAccessibilityLabel={
          hidden ? t('auth.showPassword') : t('auth.hidePassword')
        }
        {...props}
      />
    );
  }
);
