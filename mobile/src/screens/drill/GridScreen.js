import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlaceHeader from '../../components/PlaceHeader';
import { EmptyView, ErrorBanner, ErrorView, LoadingView } from '../../components/LoadState';
import { useSession } from '../../session/SessionContext';
import { t } from '../../i18n';
import { colors, font, MIN_TOUCH } from '../../theme';

export function LogoutButton() {
  const { signOut } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      testID="logout-button"
      onPress={async () => {
        if (busy) return;
        setBusy(true);
        await signOut();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('common.logout')}
      accessibilityState={{ busy }}
      style={({ pressed }) => [styles.logout, (pressed || busy) && { opacity: 0.6 }]}
    >
      <Text style={styles.logoutText}>🚪</Text>
    </Pressable>
  );
}

// One drill-down level: header + two-per-row grid of icons, with
// spinner, error + Retry, pull-to-refresh, and old data kept on a failed refresh.
// `home` screens have no back arrow and show the greeting + Logout.
export default function GridScreen({ testID, place, home, state, items, renderItem, keyOf, emptyText }) {
  const { user } = useSession();
  const { data, error, loading, refreshing, refresh, retry } = state;

  const header = (
    <PlaceHeader
      place={place}
      showBack={!home}
      greeting={home ? t('home.greeting', { name: user ? user.name : '' }) : null}
      right={home ? <LogoutButton /> : null}
    />
  );

  let body;
  if (!data && loading) body = <LoadingView />;
  else if (!data && error) body = <ErrorView error={error} onRetry={retry} />;
  else
    body = (
      <>
        {error ? <ErrorBanner error={error} onRetry={retry} /> : null}
        <FlatList
          testID={`${testID}-list`}
          data={items || []}
          keyExtractor={keyOf}
          numColumns={2}
          renderItem={({ item }) => <View style={styles.cell}>{renderItem(item)}</View>}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<EmptyView text={emptyText} />}
          refreshing={refreshing}
          onRefresh={refresh}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
        />
      </>
    );

  return (
    <SafeAreaView style={styles.safe} testID={testID} edges={['top', 'bottom']}>
      {header}
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 8, gap: 8, flexGrow: 1 },
  row: { gap: 8 },
  cell: { flex: 1, alignItems: 'center' },
  logout: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.dangerBg,
  },
  logoutText: { fontSize: font.title },
});
