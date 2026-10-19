import { Stack } from 'expo-router/stack';

export default function ProgressLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[exerciseId]" options={{ title: 'Historial' }} />
    </Stack>
  );
}
