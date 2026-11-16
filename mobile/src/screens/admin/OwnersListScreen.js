import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import { adminApi } from '../../api/admin';
import { useSession } from '../../session/SessionContext';
import { t } from '../../i18n';
import { colors, font } from '../../theme';
import { AdminScreen, EmptyText, ErrorBox, ListRow, LoadState, adminErrorText, useAdminData } from './ui';

// Admin home: every owner with phone, on/off badge and building count.
export default function OwnersListScreen() {
  const { user, signOut } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const { data, error, loading, refreshing, reload, refresh } = useAdminData(() => adminApi.listOwners());
  const owners = data ? data.owners : null;

  async function onLogout() {
    setLoggingOut(true);
    await signOut();
  }

  return (
    <AdminScreen
      testID="home-admin"
      title={t('admin.owners.title')}
      subtitle={t('home.admin')}
      showBack={false}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        <BigButton
          testID="add-owner-button"
          label={`➕ ${t('admin.owners.add')}`}
          onPress={() => router.push('/admin/owners/new')}
        />
      }
    >
      <Text testID="home-greeting" style={styles.greeting}>
        {t('home.greeting', { name: user ? user.name : '' })}
      </Text>

      <LoadState loading={loading} error={error} data={data} onRetry={reload} />
      {owners && error ? <ErrorBox text={adminErrorText(error)} onRetry={reload} /> : null}

      {owners && owners.length === 0 ? (
        <EmptyText testID="owners-empty">{t('admin.owners.empty')}</EmptyText>
      ) : null}
      {owners
        ? owners.map((o) => (
            <ListRow
              key={o.id}
              testID={`owner-row-${o.id}`}
              icon="👤"
              title={o.name}
              detail={`📱 ${o.phone} · 🏢 ${t('admin.owners.buildingCount', { count: o.building_count })}`}
              badge={o.is_active ? t('admin.on') : t('admin.off')}
              badgeOn={o.is_active}
              onPress={() => router.push(`/admin/owners/${o.id}`)}
            />
          ))
        : null}

      <View style={styles.logout}>
        <BigButton
          testID="logout-button"
          label={`🚪 ${t('common.logout')}`}
          onPress={onLogout}
          loading={loggingOut}
          variant="danger"
        />
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: font.body, color: colors.textMuted, fontWeight: '700' },
  logout: { marginTop: 24 },
});
