import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, MIN_TOUCH } from '../theme';

export default function BigButton({ label, onPress, disabled, loading, variant = 'primary', testID }) {
  const isDisabled = disabled || loading;
  const danger = variant === 'danger';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: danger ? colors.danger : colors.primary },
        (pressed || isDisabled) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} size="large" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH + 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignSelf: 'stretch',
  },
  label: { color: colors.onPrimary, fontSize: font.large, fontWeight: '700' },
});
