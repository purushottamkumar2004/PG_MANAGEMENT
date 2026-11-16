import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { t } from '../i18n';
import { colors, font, MIN_TOUCH } from '../theme';

// Top bar: back arrow (not on home screens), the current place, and an
// optional right-side control (Logout on home screens).
export default function PlaceHeader({ place, greeting, showBack = true, right }) {
  function onBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View style={styles.bar}>
      {showBack ? (
        <Pressable
          testID="back-button"
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
      ) : null}
      <View style={styles.texts}>
        {greeting ? (
          <Text testID="home-greeting" style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
        ) : null}
        <Text testID="place-title" style={styles.place} numberOfLines={2} accessibilityRole="header">
          {place}
        </Text>
      </View>
      {right || null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  backArrow: { fontSize: font.huge, fontWeight: '800', color: colors.text },
  texts: { flex: 1, paddingHorizontal: 4 },
  greeting: { fontSize: font.small, color: colors.textMuted, fontWeight: '600' },
  place: { fontSize: font.large, color: colors.text, fontWeight: '800' },
});
