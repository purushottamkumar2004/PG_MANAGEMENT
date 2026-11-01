import { Pressable, View } from 'react-native';
import { MIN_TOUCH } from '../theme';

// Base for every icon: pressable when onPress is given, never smaller than MIN_TOUCH.
export default function Tile({ onPress, accessibilityLabel, style, children, testID }) {
  const base = [{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH }, style];
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={accessibilityLabel} style={base}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}
