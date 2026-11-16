import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import BigButton from '../../components/BigButton';
import { errorText, t } from '../../i18n';
import en from '../../i18n/en';
import { colors, font, MIN_TOUCH } from '../../theme';

// Shared building blocks for the admin setup screens (T-05c).

// Text for an API error code on an admin screen. `overrides` maps a code to a
// screen-specific key (e.g. CONFLICT on the floor form -> "floor already exists").
export function adminErrorText(code, overrides = {}) {
  if (overrides[code]) return t(overrides[code]);
  const key = `admin.error.${code}`;
  if (en[key]) return t(key);
  return errorText(code);
}

// Loads data each time the screen gets focus (so lists refresh after a form
// closes). A failed reload keeps the last data on screen and shows the error.
export function useAdminData(load) {
  const [state, setState] = useState({ data: null, error: null, loading: true, refreshing: false });
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (mode) => {
    setState((s) => ({ ...s, loading: mode === 'initial' && !s.data, refreshing: mode === 'refresh' }));
    try {
      const data = await loadRef.current();
      setState({ data, error: null, loading: false, refreshing: false });
    } catch (err) {
      setState((s) => ({ ...s, error: (err && err.code) || 'INTERNAL', loading: false, refreshing: false }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      run('initial');
    }, [run])
  );

  const setData = useCallback((update) => {
    setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update }));
  }, []);

  return {
    ...state,
    setData,
    reload: () => run('initial'),
    refresh: () => run('refresh'),
  };
}

// Asks before switching an account on or off. Calls onConfirm only on "Yes".
export function confirmAction({ title, message, confirmLabel, onConfirm }) {
  Alert.alert(title, message, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/admin');
}

export function AdminHeader({ title, subtitle, showBack = true }) {
  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          testID="admin-back"
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.back}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
      ) : null}
      <View style={styles.headerText}>
        <Text testID="admin-title" style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text testID="admin-subtitle" style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Screen frame: header, scrolling body with pull-to-refresh, optional footer.
export function AdminScreen({ testID, title, subtitle, showBack, onRefresh, refreshing, footer, children }) {
  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <AdminHeader title={title} subtitle={subtitle} showBack={showBack} />
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function ErrorBox({ text, onRetry, testID = 'admin-error' }) {
  if (!text) return null;
  return (
    <View style={styles.errorBox} accessibilityLiveRegion="polite">
      <Text testID={testID} style={styles.errorText}>
        ⚠️ {text}
      </Text>
      {onRetry ? (
        <View style={styles.retry}>
          <BigButton testID="admin-retry" label={`🔄 ${t('common.retry')}`} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

// Spinner on first load; error + Retry when nothing could be loaded.
// Returns null once there is data, so the screen renders its content.
export function LoadState({ loading, error, data, onRetry }) {
  if (data) return null;
  if (loading) {
    return (
      <View style={styles.center} testID="admin-loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error) return <ErrorBox text={adminErrorText(error)} onRetry={onRetry} testID="admin-load-error" />;
  return null;
}

export function Field({ label, error, errorTestID, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        style={[styles.input, error && styles.inputError]}
        {...inputProps}
      />
      {error ? (
        <Text testID={errorTestID} style={styles.fieldError}>
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function EmptyText({ children, testID }) {
  return (
    <Text testID={testID} style={styles.empty}>
      {children}
    </Text>
  );
}

// A big tappable list row: icon, main text, small text, optional badge.
export function ListRow({ icon, title, detail, badge, badgeOn, onPress, testID, accessibilityLabel }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel || [title, detail, badge].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      {icon ? <Text style={styles.rowIcon}>{icon}</Text> : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.rowDetail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {badge ? <ActiveBadge on={badgeOn} label={badge} /> : null}
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

export function ActiveBadge({ on, label, testID }) {
  return (
    <View testID={testID} style={[styles.badge, on ? styles.badgeOn : styles.badgeOff]}>
      <Text style={[styles.badgeText, { color: on ? colors.vacant : colors.danger }]}>{label}</Text>
    </View>
  );
}

// Big on/off row. Tapping anywhere (or the switch) asks the screen to toggle;
// the switch itself only moves after the server agrees.
export function OnOffRow({ value, label, onToggle, busy, testID }) {
  const stateText = value ? t('admin.on') : t('admin.off');
  return (
    <Pressable
      testID={testID}
      onPress={busy ? undefined : onToggle}
      accessibilityRole="switch"
      accessibilityLabel={`${label}: ${stateText}`}
      accessibilityState={{ checked: !!value, busy: !!busy }}
      style={styles.onOff}
    >
      <Text style={styles.onOffLabel}>
        {value ? '🟢' : '🔴'} {label}: {stateText}
      </Text>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Switch testID={testID ? `${testID}-switch` : undefined} value={!!value} onValueChange={onToggle} />
      )}
    </Pressable>
  );
}

// Two big tiles for choosing 2 or 3 beds (no free typing).
export function CapacityPicker({ value, onChange, error }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>🛏️ {t('admin.room.capacity')}</Text>
      <View style={styles.pickerRow}>
        {[2, 3].map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              testID={`capacity-${n}`}
              onPress={() => onChange(n)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={t('room.beds', { count: n })}
              style={[styles.pickTile, selected && styles.pickTileOn]}
            >
              <Text style={styles.pickBeds}>{'🛏️'.repeat(n)}</Text>
              <Text style={[styles.pickText, selected && styles.pickTextOn]}>{t('room.beds', { count: n })}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text testID="room-capacity-error" style={styles.fieldError}>
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}

// Busy flag + server error text for a form's submit button.
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  const submit = useCallback(async (action, overrides) => {
    setServerError(null);
    setBusy(true);
    try {
      await action();
      setBusy(false);
      return true;
    } catch (err) {
      setServerError(adminErrorText((err && err.code) || 'INTERNAL', overrides));
      setBusy(false);
      return false;
    }
  }, []);
  return { busy, serverError, submit };
}

export function floorName(number) {
  return number === 0 ? t('floor.ground') : t('floor.title', { number });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  back: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: font.huge, color: colors.text, fontWeight: '700' },
  headerText: { flex: 1, paddingHorizontal: 8 },
  title: { fontSize: font.large, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.small, color: colors.textMuted },
  body: { padding: 16, gap: 12, flexGrow: 1 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  center: { padding: 32, alignItems: 'center' },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 12, padding: 14 },
  errorText: { color: colors.danger, fontSize: font.body, fontWeight: '700' },
  retry: { marginTop: 12 },
  field: { gap: 6 },
  label: { fontSize: font.body, fontWeight: '700', color: colors.text },
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
  section: { fontSize: font.body, fontWeight: '800', color: colors.textMuted, marginTop: 8 },
  empty: { fontSize: font.body, color: colors.textMuted, textAlign: 'center', padding: 16 },
  row: {
    minHeight: MIN_TOUCH + 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIcon: { fontSize: font.title },
  rowText: { flex: 1 },
  rowTitle: { fontSize: font.large, fontWeight: '700', color: colors.text },
  rowDetail: { fontSize: font.small, color: colors.textMuted },
  chevron: { fontSize: font.title, color: colors.textMuted },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2 },
  badgeOn: { borderColor: colors.vacant },
  badgeOff: { borderColor: colors.danger },
  badgeText: { fontSize: font.small, fontWeight: '800' },
  onOff: {
    minHeight: MIN_TOUCH + 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  onOffLabel: { fontSize: font.large, fontWeight: '700', color: colors.text, flex: 1 },
  pickerRow: { flexDirection: 'row', gap: 12 },
  pickTile: {
    flex: 1,
    minHeight: MIN_TOUCH * 2,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pickTileOn: { borderColor: colors.primary, backgroundColor: '#DBEAFE' },
  pickBeds: { fontSize: font.title },
  pickText: { fontSize: font.large, fontWeight: '700', color: colors.textMuted },
  pickTextOn: { color: colors.primary },
});
