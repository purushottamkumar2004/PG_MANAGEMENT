import { useLocalSearchParams } from 'expo-router';
import BedDetailScreen from '../../screens/drill/BedDetailScreen';

export default function BedRoute() {
  const { bedId } = useLocalSearchParams();
  return <BedDetailScreen bedId={bedId} />;
}
