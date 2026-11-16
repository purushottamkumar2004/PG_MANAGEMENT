import { useLocalSearchParams } from 'expo-router';
import RoomFormScreen from '../../../../../../../../../screens/admin/RoomFormScreen';

export default function NewRoomRoute() {
  const { floorId } = useLocalSearchParams();
  return <RoomFormScreen floorId={String(floorId)} />;
}
