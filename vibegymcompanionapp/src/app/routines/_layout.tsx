import { Stack } from 'expo-router/stack';

export default function RoutinesLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Nueva rutina' }} />
      <Stack.Screen name="[id]" options={{ title: 'Rutina' }} />
    </Stack>
  );
}
