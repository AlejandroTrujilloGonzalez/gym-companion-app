import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedEmptyState } from '@/components/animated-empty-state';
import { useDatabase } from '@/db/provider';
import {
  getExerciseProgressSummaries,
  getWorkoutVolumeHistory,
} from '@/db/queries/progress';
import { useTheme } from '@/hooks/use-theme';

type ExerciseSummaries = Awaited<
  ReturnType<typeof getExerciseProgressSummaries>
>;
type VolumeHistory = Awaited<ReturnType<typeof getWorkoutVolumeHistory>>;
type ListItem =
  | { type: 'section'; id: string; title: string }
  | { type: 'volume'; id: string; session: VolumeHistory[number] }
  | { type: 'record'; id: string; exercise: ExerciseSummaries[number] };

function formatVolume(value: number) {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

function formatDate(value: Date) {
  return value.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProgressScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const [summaries, setSummaries] = useState<ExerciseSummaries>([]);
  const [volumeHistory, setVolumeHistory] = useState<VolumeHistory>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    setError(null);
    try {
      const [exerciseRows, sessionRows] = await Promise.all([
        getExerciseProgressSummaries(database),
        getWorkoutVolumeHistory(database),
      ]);
      setSummaries(exerciseRows);
      setVolumeHistory(sessionRows);
    } catch {
      setError('No se pudieron cargar tus estadísticas.');
    } finally {
      setLoading(false);
    }
  }, [database]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      Promise.all([
        getExerciseProgressSummaries(database),
        getWorkoutVolumeHistory(database),
      ])
        .then(([exerciseRows, sessionRows]) => {
          if (!active) return;
          setSummaries(exerciseRows);
          setVolumeHistory(sessionRows);
        })
        .catch(() => {
          if (active) setError('No se pudieron cargar tus estadísticas.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [database]),
  );

  const items: ListItem[] = [
    ...(volumeHistory.length
      ? [
          {
            type: 'section' as const,
            id: 'volume-heading',
            title: 'Volumen por sesión',
          },
          ...volumeHistory.map((session) => ({
            type: 'volume' as const,
            id: `session-${session.sessionId}`,
            session,
          })),
        ]
      : []),
    ...(summaries.length
      ? [
          {
            type: 'section' as const,
            id: 'records-heading',
            title: 'Récords personales · Historial por ejercicio',
          },
          ...summaries.map((exercise) => ({
            type: 'record' as const,
            id: `exercise-${exercise.exerciseId}`,
            exercise,
          })),
        ]
      : []),
  ];

  if (loading && items.length === 0 && !error) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary">Cargando progreso...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <AnimatedEmptyState style={styles.emptyState}>
            <ThemedText style={styles.emptyMark}>01</ThemedText>
            <ThemedText style={styles.emptyTitle} type="subtitle">
              {error ? 'No se pudo cargar el progreso' : 'Aún no hay marcas'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {error ??
                'Finaliza un entrenamiento para ver tus récords e historial.'}
            </ThemedText>
            {error ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadProgress()}
                style={styles.emptyAction}
              >
                <ThemedText style={styles.actionText}>Reintentar</ThemedText>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/')}
                style={styles.emptyAction}
              >
                <ThemedText style={styles.actionText}>Ir a entrenar</ThemedText>
              </Pressable>
            )}
          </AnimatedEmptyState>
        }
        ListHeaderComponent={
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <ThemedText style={styles.eyebrow} themeColor="textSecondary">
                TUS MARCAS
              </ThemedText>
              <ThemedText style={styles.title}>Progreso</ThemedText>
            </View>
            {error && items.length > 0 && (
              <View style={styles.inlineError}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadProgress()}
                >
                  <ThemedText style={styles.actionText}>Reintentar</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'section') {
            return (
              <View style={styles.sectionHeading}>
                <ThemedText style={styles.sectionTitle}>
                  {item.title}
                </ThemedText>
              </View>
            );
          }

          if (item.type === 'volume') {
            const session = item.session;
            return (
              <View
                style={[styles.row, { borderColor: theme.backgroundSelected }]}
              >
                <View style={styles.rowCopy}>
                  <ThemedText type="smallBold">
                    {session.routineName} · {session.dayName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(session.finishedAt ?? session.startedAt)} ·{' '}
                    {session.setCount}{' '}
                    {session.setCount === 1 ? 'serie' : 'series'}
                  </ThemedText>
                </View>
                <View style={styles.metric}>
                  <ThemedText type="smallBold" style={styles.metricValue}>
                    {formatVolume(session.volume)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    kg × reps
                  </ThemedText>
                </View>
              </View>
            );
          }

          const exercise = item.exercise;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => router.push(`/progress/${exercise.exerciseId}`)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderColor: theme.backgroundSelected,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <View style={styles.rowCopy}>
                <ThemedText type="smallBold">
                  {exercise.exerciseName}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {exercise.muscleGroup ?? 'Sin grupo muscular'} ·{' '}
                  {exercise.sessionCount}{' '}
                  {exercise.sessionCount === 1
                    ? 'entrenamiento'
                    : 'entrenamientos'}
                </ThemedText>
              </View>
              <View style={styles.metric}>
                <ThemedText type="smallBold" style={styles.metricValue}>
                  {formatVolume(exercise.personalRecord)} kg
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Récord personal
                </ThemedText>
              </View>
            </Pressable>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { paddingHorizontal: 22, paddingBottom: 32, flexGrow: 1 },
  heading: { paddingTop: 22, paddingBottom: 24, gap: 12 },
  headingCopy: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  title: { fontSize: 36, fontWeight: '800', lineHeight: 42 },
  sectionHeading: { paddingTop: 18, paddingBottom: 7 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowCopy: { flex: 1, gap: 4 },
  metric: { alignItems: 'flex-end', gap: 2 },
  metricValue: { fontVariant: ['tabular-nums'] },
  emptyState: { paddingTop: 12, paddingBottom: 48, gap: 12 },
  emptyMark: { fontSize: 50, lineHeight: 56, fontWeight: '800', opacity: 0.16 },
  emptyTitle: { fontSize: 23, lineHeight: 29 },
  emptyAction: { alignSelf: 'flex-start', paddingTop: 6 },
  actionText: { fontWeight: '700', textDecorationLine: 'underline' },
  inlineError: { gap: 6 },
  errorText: { color: '#a93226', fontSize: 14 },
});
