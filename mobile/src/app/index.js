import { Redirect } from 'expo-router';
import { useSession } from '../session/SessionContext';
import { homeRouteForRole } from '../session/routes';

// Entry point: send the user to Login or to their role's home.
export default function Index() {
  const { user } = useSession();
  const home = user ? homeRouteForRole(user.role) : null;
  return <Redirect href={home || '/login'} />;
}
