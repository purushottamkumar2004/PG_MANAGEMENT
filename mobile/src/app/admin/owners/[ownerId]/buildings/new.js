import { useLocalSearchParams } from 'expo-router';
import { NewBuildingScreen } from '../../../../../screens/admin/BuildingFormScreen';

export default function NewBuildingRoute() {
  const { ownerId } = useLocalSearchParams();
  return <NewBuildingScreen ownerId={String(ownerId)} />;
}
