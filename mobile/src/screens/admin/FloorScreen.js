import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import RoomIcon from '../../components/RoomIcon';
import { t } from '../../i18n';
import { AdminScreen, EmptyText, ErrorBox, LoadState, adminErrorText, floorName, useAdminData } from './ui';
import { loadFloor } from './loaders';

// One floor: its rooms with bed capacity, and "+ Room".
export default function FloorScreen({ ownerId, buildingId, floorId }) {
  const { data, error, loading, refreshing, reload, refresh } = useAdminData(() =>
    loadFloor(ownerId, buildingId, floorId)
  );
  const floor = data && data.floor;

  return (
    <AdminScreen
      testID="floor-screen"
      title={floor ? floorName(floor.floor_number) : t('admin.floors.title')}
      subtitle={data ? `🏢 ${data.building.name}` : null}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        floor ? (
          <BigButton
            testID="add-room-button"
            label={`➕ ${t('admin.rooms.add')}`}
            onPress={() => router.push(`/admin/owners/${ownerId}/buildings/${buildingId}/floors/${floorId}/rooms/new`)}
          />
        ) : null
      }
    >
      <LoadState loading={loading} error={error} data={data} onRetry={reload} />
      {data && error ? <ErrorBox text={adminErrorText(error)} onRetry={reload} /> : null}
      {floor && floor.rooms.length === 0 ? <EmptyText testID="rooms-empty">{t('admin.rooms.empty')}</EmptyText> : null}
      {floor ? (
        <View style={styles.grid}>
          {floor.rooms.map((r) => (
            <RoomIcon key={r.id} testID={`room-${r.id}`} roomNumber={r.room_number} bedCapacity={r.bed_capacity} />
          ))}
        </View>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
