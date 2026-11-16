import { router } from 'expo-router';
import RoomIcon from '../../components/RoomIcon';
import GridScreen from './GridScreen';
import { structureApi } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { floorTitle, placeText } from '../../format';
import { t } from '../../i18n';

// Rooms of one floor. The building name comes from the previous screen (param b);
// the contract's rooms response has only the floor.
export default function RoomsScreen({ floorId, buildingName }) {
  const state = useApiData(() => structureApi.rooms(floorId), floorId);
  const floor = state.data ? state.data.floor : null;
  const rooms = state.data ? state.data.rooms : [];
  const place = placeText([buildingName, floor ? floorTitle(floor.floor_number) : null]);

  return (
    <GridScreen
      testID="rooms-screen"
      place={place}
      state={state}
      items={rooms}
      keyOf={(r) => r.id}
      emptyText={t('drill.emptyRooms')}
      renderItem={(r) => (
        <RoomIcon
          testID={`room-${r.id}`}
          roomNumber={r.room_number}
          bedCapacity={r.bed_capacity}
          onPress={() =>
            router.push({ pathname: '/room/[roomId]', params: { roomId: r.id, b: buildingName || '' } })
          }
        />
      )}
    />
  );
}
