import { useLocalSearchParams } from 'expo-router';
import { EditBuildingScreen } from '../../../../../../screens/admin/BuildingFormScreen';

export default function EditBuildingRoute() {
  const { ownerId, buildingId } = useLocalSearchParams();
  return <EditBuildingScreen ownerId={String(ownerId)} buildingId={String(buildingId)} />;
}
