import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/db/provider';
import {
  getExerciseHistory,
  getExerciseProgressSummaries,
} from '@/db/queries/progress';
import { useTheme } from '@/hooks/use-theme';

type ExerciseSummaries = Awaited<
  ReturnType<typeof getExerciseProgressSummaries>
>;
type ExerciseHistory = Awaited<ReturnType<typeof getExerciseHistory>>;
type ExerciseSummary = ExerciseSummaries[number];
type ExerciseWorkout = ExerciseHistory[number];

function formatDate(value: Date) {
  return value.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatVolume(value: number) {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

export default function ExerciseProgressScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const { exerciseId: routeExerciseId } = useLocalSearchParams<{
    exerciseId: string;
  }>();
  const exerciseId = Number(routeExerciseId);
  const [exercise, setExercise] = useState<ExerciseSummary | null>(null);
  const [history, setHistory] = useState<ExerciseHistory>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!Number.isInteger(exerciseId) || exerciseId < 1) {
      throw new Error('El ejercicio no está disponible.');
    }

    const [summaries, historyRows] = await Promise.all([
      getExerciseProgressSummaries(database),
      getExerciseHistory(database, exerciseId),
    ]);
    const exerciseRow = summaries.find(
      (item) => item.exerciseId === exerciseId,
    );
    if (!exerciseRow) throw new Error('El ejercicio no tiene historial.');
    return { exerciseRow, historyRows };
  }, [database, exerciseId]);

  const applyHistory = useCallback(
    (data: Awaited<ReturnType<typeof loadHistory>>) => {
      setExercise(data.exerciseRow);
      setHistory(data.historyRows);
    },
    [],
  );

  const refreshHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyHistory(await loadHistory());
    } catch {
      setError('No se pudo cargar el historial. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [applyHistory, loadHistory]);

  useEffect(() => {
    let active = true;
    loadHistory()
      .then((data) => {
        if (active) applyHistory(data);
      })
      .catch(() => {
        if (active)
          setError('No se pudo cargar el historial. Inténtalo de nuevo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyHistory, loadHistory]);

  const bestSet = useMemo(() => {
    let best: {
      set: ExerciseWorkout['sets'][number];
      session: ExerciseWorkout;
    } | null = null;
    for (const session of history) {
      for (const set of session.sets) {
        if (!best || set.weight > best.set.weight) best = { set, session };
      }
    }
    return best;
  }, [history]);

  const chartPoints = useMemo(() => {
    const chronologicalHistory = [...history].reverse();
    const labelInterval = Math.max(
      1,
      Math.ceil(chronologicalHistory.length / 5),
    );

    return chronologicalHistory.map((session, index) => ({
      value: session.maxWeight,
      label:
        index === 0 ||
        index === chronologicalHistory.length - 1 ||
        index % labelInterval === 0
          ? session.startedAt.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
            })
          : '',
    }));
  }, [history]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary">
          Cargando historial...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!exercise) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle" style={styles.errorTitle}>
          Historial no disponible
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {error ?? 'No hay sesiones finalizadas para este ejercicio.'}
        </ThemedText>
        {error && (
          <ThemedText
            accessibilityRole="button"
            onPress={() => void refreshHistory()}
            style={styles.actionText}
          >
            Reintentar
          </ThemedText>
        )}
      </ThemedView>
    );
  }

  const chartMax = Math.max(
    4,
    Math.ceil(Math.max(...chartPoints.map((point) => point.value), 0) / 4),
  );
  const chartWidth = Math.max(
    viewportWidth - 76,
    62 + Math.max(0, chartPoints.length - 1) * 46,
  );

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.heading}>
          <ThemedText style={styles.eyebrow} themeColor="textSecondary">
            {exercise.muscleGroup ?? 'HISTORIAL DE EJERCICIO'}
          </ThemedText>
          <ThemedText style={styles.title}>{exercise.exerciseName}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {history.length}{' '}
            {history.length === 1
              ? 'entrenamiento registrado'
              : 'entrenamientos registrados'}
          </ThemedText>
        </View>

        {bestSet && (
          <View style={styles.recordRow}>
            <View style={styles.recordCopy}>
              <ThemedText style={styles.sectionTitle}>
                Récord personal
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                {bestSet.set.reps} repeticiones ·{' '}
                {formatDate(bestSet.session.startedAt)}
              </ThemedText>
            </View>
            <ThemedText style={styles.recordValue}>
              {formatVolume(bestSet.set.weight)} kg
            </ThemedText>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>
              Peso máximo por sesión
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              kg
            </ThemedText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={chartWidth > viewportWidth - 76}
            style={styles.chartScroller}
          >
            <LineChart
              data={chartPoints}
              width={chartWidth}
              height={210}
              spacing={46}
              initialSpacing={18}
              endSpacing={18}
              maxValue={chartMax * 4}
              noOfSections={4}
              stepValue={chartMax}
              color="#34865b"
              thickness={2}
              dataPointsColor="#34865b"
              dataPointsRadius={4}
              xAxisColor={theme.backgroundSelected}
              yAxisColor={theme.backgroundSelected}
              xAxisLabelTextStyle={{
                color: theme.textSecondary,
                fontSize: 10,
              }}
              yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
              rulesColor={theme.backgroundElement}
              rulesThickness={1}
              yAxisLabelSuffix=" kg"
              showFractionalValues
              roundToDigits={1}
              hideOrigin
            />
          </ScrollView>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            Series registradas
          </ThemedText>
          {history.map((session) => (
            <View
              key={session.sessionId}
              style={[
                styles.historySession,
                { borderColor: theme.backgroundSelected },
              ]}
            >
              <View style={styles.historyHeading}>
                <ThemedText type="smallBold">
                  {formatDate(session.finishedAt ?? session.startedAt)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Volumen {formatVolume(session.volume)} kg × reps
                </ThemedText>
              </View>
              {session.sets.map((set) => (
                <View
                  key={`${session.sessionId}-${set.setNumber}`}
                  style={styles.setRow}
                >
                  <ThemedText type="small" themeColor="textSecondary">
                    Serie {set.setNumber}
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.setValue}>
                    {formatVolume(set.weight)} kg × {set.reps}
                    {set.rpe === null ? '' : ` · RPE ${formatVolume(set.rpe)}`}
                  </ThemedText>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
    gap: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 24,
  },
  heading: { gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  recordRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#aeb4b8',
    gap: 14,
  },
  recordCopy: { flex: 1, gap: 4 },
  recordValue: {
    fontSize: 21,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  section: { gap: 10 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  chartScroller: { marginHorizontal: -8 },
  historySession: {
    gap: 9,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  setValue: { fontVariant: ['tabular-nums'] },
  errorTitle: { textAlign: 'center' },
  actionText: { fontWeight: '700', textDecorationLine: 'underline' },
});
