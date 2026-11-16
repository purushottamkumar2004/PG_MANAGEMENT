import { useLocalSearchParams } from 'expo-router';
import ManagerFormScreen from '../../../../../../screens/admin/ManagerFormScreen';

export default function ManagerRoute() {
  const { ownerId, buildingId } = useLocalSearchParams();
  return <ManagerFormScreen ownerId={String(ownerId)} buildingId={String(buildingId)} />;
}
