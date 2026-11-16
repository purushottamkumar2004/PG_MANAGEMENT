import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../session/SessionContext';
import { colors } from '../theme';

function RootNavigator() {
  const { status, user } = useSession();

  if (status === 'loading') {
    return (
      <View style={styles.loading} testID="app-loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const role = user ? user.role : null;

  // Each role can only reach its own home. When the session changes
  // (login, logout, 401) the guards change and the router moves the user.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="admin/index" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'owner'}>
        <Stack.Screen name="owner/index" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'manager'}>
        <Stack.Screen name="manager/index" />
      </Stack.Protected>
      {/* Drill-down (T-05b), shared by owner and manager. The server scopes the data. */}
      <Stack.Protected guard={role === 'owner' || role === 'manager'}>
        <Stack.Screen name="building/[buildingId]" />
        <Stack.Screen name="floor/[floorId]" />
        <Stack.Screen name="room/[roomId]" />
        <Stack.Screen name="bed/[bedId]" />
      </Stack.Protected>
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="dev-components" options={{ headerShown: true, title: 'Components (dev)' }} />
      </Stack.Protected>
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
