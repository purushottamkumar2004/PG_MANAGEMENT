import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BigButton from '../components/BigButton';
import { useSession } from '../session/SessionContext';
import { t } from '../i18n';
import { colors, font } from '../theme';

// Placeholder home for each role (T-05a). Real content arrives in later tasks.
export default function HomeScreen({ roleKey, testID }) {
  const { user, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    await signOut();
  }

  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <View style={styles.content}>
        <Text style={styles.role}>{t(roleKey)}</Text>
        <Text testID="home-greeting" style={styles.greeting}>
          {t('home.greeting', { name: user ? user.name : '' })}
        </Text>
      </View>
      <View style={styles.footer}>
        <BigButton
          testID="logout-button"
          label={`🚪 ${t('common.logout')}`}
          onPress={onLogout}
          loading={busy}
          variant="danger"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  role: { fontSize: font.large, color: colors.textMuted, fontWeight: '700' },
  greeting: { fontSize: font.title, color: colors.text, fontWeight: '800', textAlign: 'center' },
  footer: { padding: 24 },
});
