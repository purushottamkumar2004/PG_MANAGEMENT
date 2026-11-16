import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import BigButton from './BigButton';
import { errorText, t } from '../i18n';
import { colors, font, MIN_TOUCH } from '../theme';

// Full-screen spinner for the first load.
export function LoadingView() {
  return (
    <View style={styles.center} testID="screen-loading">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

// Full-screen error when there is nothing to show yet.
export function ErrorView({ error, onRetry }) {
  return (
    <View style={styles.center} testID="screen-error">
      <Text style={styles.bigIcon}>⚠️</Text>
      <Text testID="screen-error-text" style={styles.errorText}>
        {errorText(error && error.code)}
      </Text>
      <View style={styles.retryWrap}>
        <BigButton testID="retry-button" label={`🔄 ${t('common.retry')}`} onPress={onRetry} />
      </View>
    </View>
  );
}

// Thin banner shown above old data when a refresh fails.
export function ErrorBanner({ error, onRetry }) {
  return (
    <View style={styles.banner} testID="error-banner" accessibilityLiveRegion="polite">
      <Text style={styles.bannerText} testID="error-banner-text">
        ⚠️ {errorText(error && error.code)}
      </Text>
      <Pressable
        testID="banner-retry-button"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t('common.retry')}
        style={({ pressed }) => [styles.bannerButton, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.bannerButtonText}>🔄 {t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

export function EmptyView({ text }) {
  return (
    <View style={styles.center} testID="screen-empty">
      <Text style={styles.bigIcon}>📭</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, minHeight: 300 },
  bigIcon: { fontSize: 56 },
  errorText: { fontSize: font.large, color: colors.danger, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: font.large, color: colors.textMuted, fontWeight: '700', textAlign: 'center' },
  retryWrap: { alignSelf: 'stretch', marginTop: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerText: { flex: 1, color: colors.danger, fontSize: font.body, fontWeight: '700' },
  bannerButton: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerButtonText: { color: colors.onPrimary, fontSize: font.body, fontWeight: '700' },
});
