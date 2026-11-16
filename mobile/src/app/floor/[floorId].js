import { useLocalSearchParams } from 'expo-router';
import RoomsScreen from '../../screens/drill/RoomsScreen';

export default function FloorRoute() {
  const { floorId, b } = useLocalSearchParams();
  return <RoomsScreen floorId={floorId} buildingName={b} />;
}
