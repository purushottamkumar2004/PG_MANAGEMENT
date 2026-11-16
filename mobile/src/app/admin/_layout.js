import { Stack } from 'expo-router';

// Admin setup screens (T-05c). The root layout only lets role "admin" in here.
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
