import { router } from 'expo-router';
import FloorIcon from '../../components/FloorIcon';
import GridScreen from './GridScreen';
import { structureApi } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { t } from '../../i18n';

// Floors of one building. Also the manager's home (home = true).
export default function FloorsScreen({ buildingId, home = false, testID = 'floors-screen' }) {
  const state = useApiData(() => structureApi.floors(buildingId), buildingId);
  const building = state.data ? state.data.building : null;
  const floors = state.data ? state.data.floors : [];
  const buildingName = building ? building.name : '';

  return (
    <GridScreen
      testID={testID}
      home={home}
      place={buildingName}
      state={state}
      items={floors}
      keyOf={(f) => f.id}
      emptyText={t('drill.emptyFloors')}
      renderItem={(f) => (
        <FloorIcon
          testID={`floor-${f.id}`}
          floorNumber={f.floor_number}
          freeBeds={f.free_beds}
          onPress={() =>
            router.push({ pathname: '/floor/[floorId]', params: { floorId: f.id, b: buildingName } })
          }
        />
      )}
    />
  );
}
