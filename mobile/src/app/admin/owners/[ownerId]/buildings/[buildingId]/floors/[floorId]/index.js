import { useLocalSearchParams } from 'expo-router';
import FloorScreen from '../../../../../../../../screens/admin/FloorScreen';

export default function FloorRoute() {
  const { ownerId, buildingId, floorId } = useLocalSearchParams();
  return <FloorScreen ownerId={String(ownerId)} buildingId={String(buildingId)} floorId={String(floorId)} />;
}
