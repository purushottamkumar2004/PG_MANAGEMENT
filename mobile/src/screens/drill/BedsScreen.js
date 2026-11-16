import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import BedIcon from '../../components/BedIcon';
import GridScreen from './GridScreen';
import { structureApi } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { floorTitle, placeText } from '../../format';
import { t } from '../../i18n';
import { colors, font } from '../../theme';

// Beds of one room, coloured by the status the API returns (never computed here).
export default function BedsScreen({ roomId, buildingName }) {
  const state = useApiData(() => structureApi.beds(roomId), roomId);
  const room = state.data ? state.data.room : null;
  const beds = state.data ? state.data.beds : [];
  const place = placeText([
    buildingName,
    room ? floorTitle(room.floor_number) : null,
    room ? t('room.title', { number: room.room_number }) : null,
  ]);

  return (
    <GridScreen
      testID="beds-screen"
      place={place}
      state={state}
      items={beds}
      keyOf={(b) => b.id}
      emptyText={t('drill.emptyBeds')}
      renderItem={(b) => (
        <View style={styles.bed}>
          <BedIcon
            testID={`bed-${b.id}`}
            label={b.bed_label}
            status={b.status}
            onPress={() => router.push({ pathname: '/bed/[bedId]', params: { bedId: b.id } })}
          />
          {b.tenant ? (
            <Text testID={`bed-${b.id}-tenant`} style={styles.name} numberOfLines={1}>
              {b.tenant.name}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bed: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text, maxWidth: 160 },
});
