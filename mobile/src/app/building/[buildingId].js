import { useLocalSearchParams } from 'expo-router';
import FloorsScreen from '../../screens/drill/FloorsScreen';

export default function BuildingRoute() {
  const { buildingId } = useLocalSearchParams();
  return <FloorsScreen buildingId={buildingId} />;
}
