import { useLocalSearchParams } from 'expo-router';
import BuildingScreen from '../../../../../../screens/admin/BuildingScreen';

export default function BuildingRoute() {
  const { ownerId, buildingId } = useLocalSearchParams();
  return <BuildingScreen ownerId={String(ownerId)} buildingId={String(buildingId)} />;
}
