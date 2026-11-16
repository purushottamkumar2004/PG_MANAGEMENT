import { useLocalSearchParams } from 'expo-router';
import OwnerScreen from '../../../../screens/admin/OwnerScreen';

export default function OwnerRoute() {
  const { ownerId } = useLocalSearchParams();
  return <OwnerScreen ownerId={String(ownerId)} />;
}
