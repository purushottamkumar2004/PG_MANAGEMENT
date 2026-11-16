import FloorsScreen from '../../screens/drill/FloorsScreen';
import HomeScreen from '../../screens/HomeScreen';
import { useSession } from '../../session/SessionContext';

// Manager home skips the building list: straight to the floors of their one building.
export default function ManagerHome() {
  const { user } = useSession();
  if (!user || !user.building_id) return <HomeScreen roleKey="drill.noBuilding" testID="home-manager" />;
  return <FloorsScreen buildingId={user.building_id} home testID="home-manager" />;
}
