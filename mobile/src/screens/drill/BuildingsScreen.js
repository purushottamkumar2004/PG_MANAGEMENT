import { router } from 'expo-router';
import BuildingIcon from '../../components/BuildingIcon';
import GridScreen from './GridScreen';
import { structureApi } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { t } from '../../i18n';

// Owner home: every building of this owner, with photo and free/total beds.
export default function BuildingsScreen() {
  const state = useApiData(() => structureApi.buildings(), 'buildings');
  const buildings = state.data ? state.data.buildings : [];

  return (
    <GridScreen
      testID="home-owner"
      home
      place={t('drill.buildings')}
      state={state}
      items={buildings}
      keyOf={(b) => b.id}
      emptyText={t('drill.emptyBuildings')}
      renderItem={(b) => (
        <BuildingIcon
          testID={`building-${b.id}`}
          name={b.name}
          photoUrl={b.photo_url}
          freeBeds={b.free_beds}
          totalBeds={b.total_beds}
          onPress={() => router.push({ pathname: '/building/[buildingId]', params: { buildingId: b.id } })}
        />
      )}
    />
  );
}
