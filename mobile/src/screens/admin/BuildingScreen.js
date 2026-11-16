import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import { adminApi } from '../../api/admin';
import { t } from '../../i18n';
import { colors, font } from '../../theme';
import {
  AdminScreen,
  EmptyText,
  ErrorBox,
  ListRow,
  LoadState,
  OnOffRow,
  SectionTitle,
  adminErrorText,
  confirmAction,
  floorName,
  useAdminData,
} from './ui';
import { loadBuilding } from './loaders';

// One building: details (edit), manager card (add / edit / on-off), floors, "+ Floor".
export default function BuildingScreen({ ownerId, buildingId }) {
  const { data, error, loading, refreshing, reload, refresh, setData } = useAdminData(() =>
    loadBuilding(ownerId, buildingId)
  );
  const [toggling, setToggling] = useState(false);
  const [actionError, setActionError] = useState(null);
  const building = data && data.building;
  const manager = building && building.manager;
  const base = `/admin/owners/${ownerId}/buildings/${buildingId}`;

  function onToggleManager() {
    if (!manager || toggling) return;
    const next = !manager.is_active;
    confirmAction({
      title: next ? t('admin.manager.confirmOnTitle') : t('admin.manager.confirmOffTitle'),
      message: next
        ? t('admin.manager.confirmOn', { name: manager.name })
        : t('admin.manager.confirmOff', { name: manager.name }),
      confirmLabel: next ? t('admin.switchOn') : t('admin.switchOff'),
      onConfirm: async () => {
        setActionError(null);
        setToggling(true);
        try {
          const res = await adminApi.updateManager(manager.id, { is_active: next });
          const updated = res && res.manager;
          setData((d) => ({
            ...d,
            building: { ...d.building, manager: { ...d.building.manager, ...(updated || { is_active: next }) } },
          }));
        } catch (err) {
          setActionError(adminErrorText((err && err.code) || 'INTERNAL'));
        }
        setToggling(false);
      },
    });
  }

  return (
    <AdminScreen
      testID="building-screen"
      title={building ? building.name : t('admin.building.title')}
      subtitle={building && building.address ? `📍 ${building.address}` : null}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        building ? (
          <BigButton
            testID="add-floor-button"
            label={`➕ ${t('admin.floors.add')}`}
            onPress={() => router.push(`${base}/floors/new`)}
          />
        ) : null
      }
    >
      <LoadState loading={loading} error={error} data={data} onRetry={reload} />
      {data && error ? <ErrorBox text={adminErrorText(error)} onRetry={reload} /> : null}
      {building ? (
        <>
          <View style={styles.card}>
            <Text testID="building-photo-url" style={styles.detail} numberOfLines={2}>
              🖼️ {building.photo_url || t('building.noPhoto')}
            </Text>
            <BigButton
              testID="edit-building-button"
              label={`✏️ ${t('admin.building.edit')}`}
              onPress={() => router.push(`${base}/edit`)}
            />
          </View>

          <SectionTitle>🧑‍💼 {t('admin.manager.title')}</SectionTitle>
          {manager ? (
            <View style={styles.card} testID="manager-card">
              <Text testID="manager-name" style={styles.name}>
                {manager.name}
              </Text>
              <Text testID="manager-phone" style={styles.detail}>
                📱 {manager.phone}
              </Text>
              <OnOffRow
                testID="manager-active"
                label={t('admin.manager.account')}
                value={manager.is_active}
                onToggle={onToggleManager}
                busy={toggling}
              />
              <ErrorBox text={actionError} testID="manager-action-error" />
              <BigButton
                testID="edit-manager-button"
                label={`✏️ ${t('admin.manager.edit')}`}
                onPress={() => router.push(`${base}/manager`)}
              />
            </View>
          ) : (
            <View style={styles.card} testID="manager-none">
              <Text style={styles.detail}>{t('admin.manager.none')}</Text>
              <BigButton
                testID="add-manager-button"
                label={`➕ ${t('admin.manager.add')}`}
                onPress={() => router.push(`${base}/manager`)}
              />
            </View>
          )}

          <SectionTitle>🪜 {t('admin.floors.title')}</SectionTitle>
          {building.floors.length === 0 ? (
            <EmptyText testID="floors-empty">{t('admin.floors.empty')}</EmptyText>
          ) : (
            building.floors.map((f) => (
              <ListRow
                key={f.id}
                testID={`floor-row-${f.id}`}
                icon="🪜"
                title={floorName(f.floor_number)}
                detail={t('admin.floors.roomCount', { count: (f.rooms || []).length })}
                onPress={() => router.push(`${base}/floors/${f.id}`)}
              />
            ))
          )}
        </>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 10 },
  name: { fontSize: font.large, fontWeight: '800', color: colors.text },
  detail: { fontSize: font.body, color: colors.textMuted },
});
