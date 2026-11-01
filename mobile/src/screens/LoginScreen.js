import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import BigButton from '../components/BigButton';
import { useSession } from '../session/SessionContext';
import { cleanPhone, validateLogin } from './loginValidation';
import { errorText, t } from '../i18n';
import { colors, font, MIN_TOUCH } from '../theme';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setServerError(null);
    const errors = validateLogin({ phone, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      await signIn(phone, password);
      // Navigation happens in the root layout once the session changes.
    } catch (err) {
      setServerError(errorText(err && err.code));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.appName}>🏠 {t('app.name')}</Text>
          <Text style={styles.title}>{t('login.title')}</Text>

          <Text style={styles.label}>📱 {t('login.phone')}</Text>
          <TextInput
            testID="login-phone"
            value={phone}
            onChangeText={(text) => setPhone(cleanPhone(text))}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel"
            placeholder={t('login.phonePlaceholder')}
            accessibilityLabel={t('login.phone')}
            style={[styles.input, fieldErrors.phone && styles.inputError]}
            editable={!busy}
          />
          {fieldErrors.phone ? (
            <Text testID="login-phone-error" style={styles.fieldError}>
              {t(fieldErrors.phone)}
            </Text>
          ) : null}

          <Text style={styles.label}>🔒 {t('login.password')}</Text>
          <TextInput
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            accessibilityLabel={t('login.password')}
            style={[styles.input, fieldErrors.password && styles.inputError]}
            editable={!busy}
            onSubmitEditing={onLogin}
          />
          {fieldErrors.password ? (
            <Text testID="login-password-error" style={styles.fieldError}>
              {t(fieldErrors.password)}
            </Text>
          ) : null}

          {serverError ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Text testID="login-error" style={styles.errorText}>
                ⚠️ {serverError}
              </Text>
            </View>
          ) : null}

          <View style={styles.buttonWrap}>
            <BigButton testID="login-button" label={t('login.button')} onPress={onLogin} loading={busy} />
          </View>

          {__DEV__ ? (
            <Pressable
              testID="dev-components-link"
              onPress={() => router.push('/dev-components')}
              accessibilityRole="button"
              style={styles.devLink}
            >
              <Text style={styles.devLinkText}>{t('login.devComponents')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 24, gap: 8, flexGrow: 1, justifyContent: 'center' },
  appName: { fontSize: font.title, fontWeight: '800', color: colors.text, textAlign: 'center' },
  title: { fontSize: font.large, color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: font.body, fontWeight: '700', color: colors.text, marginTop: 12 },
  input: {
    minHeight: MIN_TOUCH + 8,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: font.large,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: font.body },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 12, padding: 14, marginTop: 12 },
  errorText: { color: colors.danger, fontSize: font.body, fontWeight: '700' },
  buttonWrap: { marginTop: 24 },
  devLink: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  devLinkText: { color: colors.textMuted, fontSize: font.small, textDecorationLine: 'underline' },
});
