import { useLocalSearchParams } from 'expo-router';
import BedsScreen from '../../screens/drill/BedsScreen';

export default function RoomRoute() {
  const { roomId, b } = useLocalSearchParams();
  return <BedsScreen roomId={roomId} buildingName={b} />;
}
