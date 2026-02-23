/**
 * app/(dashboard)/_layout.tsx
 * Layout for the admin dashboard route group.
 */
import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants';

export default function DashboardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'fade',
      }}
    />
  );
}
