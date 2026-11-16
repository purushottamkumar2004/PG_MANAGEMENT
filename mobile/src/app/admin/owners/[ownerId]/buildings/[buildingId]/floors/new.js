import { useLocalSearchParams } from 'expo-router';
import FloorFormScreen from '../../../../../../../screens/admin/FloorFormScreen';

export default function NewFloorRoute() {
  const { buildingId } = useLocalSearchParams();
  return <FloorFormScreen buildingId={String(buildingId)} />;
}
