import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/db/provider';
import { getRoutineDayExercises } from '@/db/queries/routine-day-exercises';
import {
  finishWorkoutSession,
  getPreviousWorkoutSetLogs,
  getWorkoutSessionDetails,
  getWorkoutSetLogs,
  saveWorkoutSet,
} from '@/db/queries/workout-sessions';
import type { SetLog } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';

type SessionDetails = NonNullable<
  Awaited<ReturnType<typeof getWorkoutSessionDetails>>
>;
type ExerciseRows = Awaited<ReturnType<typeof getRoutineDayExercises>>;
type Draft = { weight: string; reps: string; rpe: string };
type PreviousLogs = Awaited<ReturnType<typeof getPreviousWorkoutSetLogs>>;

function setKey(exerciseId: number, setNumber: number) {
  return `${exerciseId}:${setNumber}`;
}

function numberText(value: number) {
  return String(value);
}

export default function WorkoutSessionScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const { sessionId: routeSessionId } = useLocalSearchParams<{
    sessionId: string;
  }>();
  const sessionId = Number(routeSessionId);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [exercises, setExercises] = useState<ExerciseRows>([]);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingSetKey, setSavingSetKey] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkout = useCallback(async () => {
    const sessionRow = await getWorkoutSessionDetails(database, sessionId);
    if (!sessionRow) throw new Error('La sesión no está disponible.');

    const [exerciseRows, sessionLogs] = await Promise.all([
      getRoutineDayExercises(database, sessionRow.routineDayId),
      getWorkoutSetLogs(database, sessionId),
    ]);
    const previousByExercise = await Promise.all(
      exerciseRows.map(async (exercise) => ({
        exerciseId: exercise.exerciseId,
        logs: await getPreviousWorkoutSetLogs(
          database,
          exercise.exerciseId,
          sessionId,
        ),
      })),
    );
    const previousLogMap = new Map<number, PreviousLogs>(
      previousByExercise.map((item) => [item.exerciseId, item.logs]),
    );
    const nextDrafts: Record<string, Draft> = {};

    for (const exercise of exerciseRows) {
      const previousLogs = previousLogMap.get(exercise.exerciseId) ?? [];
      for (
        let setNumber = 1;
        setNumber <= exercise.targetSets;
        setNumber += 1
      ) {
        const savedLog = sessionLogs.find(
          (log) =>
            log.exerciseId === exercise.exerciseId &&
            log.setNumber === setNumber,
        );
        const previousLog =
          previousLogs.find((log) => log.setNumber === setNumber) ??
          previousLogs[0];
        const source = savedLog ?? previousLog;
        nextDrafts[setKey(exercise.exerciseId, setNumber)] = {
          weight: source ? numberText(source.weight) : '',
          reps: source ? String(source.reps) : String(exercise.targetReps),
          rpe: source?.rpe == null ? '' : numberText(source.rpe),
        };
      }
    }

    return { sessionRow, exerciseRows, sessionLogs, nextDrafts };
  }, [database, sessionId]);

  const applyWorkout = useCallback(
    (data: Awaited<ReturnType<typeof loadWorkout>>) => {
      setSession(data.sessionRow);
      setExercises(data.exerciseRows);
      setLogs(data.sessionLogs);
      setDrafts(data.nextDrafts);
    },
    [],
  );

  const refreshWorkout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyWorkout(await loadWorkout());
    } catch {
      setError('No se pudo cargar la sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [applyWorkout, loadWorkout]);

  useEffect(() => {
    let active = true;
    loadWorkout()
      .then((data) => {
        if (active) applyWorkout(data);
      })
      .catch(() => {
        if (active)
          setError('No se pudo cargar la sesión. Inténtalo de nuevo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyWorkout, loadWorkout]);

  function updateDraft(key: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  }

  async function saveSet(exerciseId: number, setNumber: number) {
    const key = setKey(exerciseId, setNumber);
    const draft = drafts[key];
    const weight = Number(draft.weight.replace(',', '.'));
    const reps = Number(draft.reps);
    const rpeText = draft.rpe.trim();
    const rpe = rpeText ? Number(rpeText.replace(',', '.')) : null;

    if (!draft.weight.trim() || !Number.isFinite(weight) || weight < 0) {
      setError('Indica un peso válido para la serie.');
      return;
    }
    if (!Number.isInteger(reps) || reps < 1) {
      setError('Las repeticiones deben ser un entero mayor que cero.');
      return;
    }
    if (rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) {
      setError('El RPE debe estar entre 1 y 10.');
      return;
    }

    setSavingSetKey(key);
    setError(null);
    try {
      await saveWorkoutSet(database, {
        sessionId,
        exerciseId,
        setNumber,
        weight,
        reps,
        rpe,
      });
      setLogs(await getWorkoutSetLogs(database, sessionId));
    } catch {
      setError('No se guardó la serie. Tus datos siguen en pantalla.');
    } finally {
      setSavingSetKey(null);
    }
  }

  async function finishSession() {
    setFinishing(true);
    setError(null);
    try {
      await finishWorkoutSession(database, sessionId);
      router.replace('/');
    } catch {
      setError('No se pudo finalizar la sesión. Inténtalo de nuevo.');
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary">Cargando sesión...</ThemedText>
      </ThemedView>
    );
  }

  if (!session) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle" style={styles.notFoundTitle}>
          Sesión no disponible
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {error ?? 'Puede que la rutina se haya eliminado.'}
        </ThemedText>
        {error && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshWorkout()}
          >
            <ThemedText style={styles.actionText}>Reintentar</ThemedText>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/')}
        >
          <ThemedText style={styles.actionText}>Volver a Hoy</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const totalSets = exercises.reduce(
    (total, exercise) => total + exercise.targetSets,
    0,
  );
  const savedSets = logs.length;
  const isFinished = session.finishedAt !== null;

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sessionHeading}>
            <ThemedText style={styles.eyebrow} themeColor="textSecondary">
              {session.routineName}
            </ThemedText>
            <ThemedText style={styles.title}>{session.dayName}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {savedSets} de {totalSets} series guardadas
            </ThemedText>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.text,
                    width: `${totalSets ? (savedSets / totalSets) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              {error.startsWith('No se pudo cargar') && (
                <Pressable onPress={() => void refreshWorkout()}>
                  <ThemedText style={styles.actionText}>Reintentar</ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {exercises.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle">
                Este día no tiene ejercicios
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Añade ejercicios a la rutina antes de registrar el
                entrenamiento.
              </ThemedText>
            </View>
          ) : (
            exercises.map((exercise, exerciseIndex) => (
              <View key={exercise.id} style={styles.exerciseSection}>
                <View style={styles.exerciseHeading}>
                  <ThemedText
                    style={styles.exerciseNumber}
                    themeColor="textSecondary"
                  >
                    {String(exerciseIndex + 1).padStart(2, '0')}
                  </ThemedText>
                  <View style={styles.exerciseCopy}>
                    <ThemedText style={styles.exerciseName}>
                      {exercise.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Objetivo: {exercise.targetSets} × {exercise.targetReps}
                      {exercise.muscleGroup ? ` · ${exercise.muscleGroup}` : ''}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.columnLabels}>
                  <ThemedText style={styles.setColumn}>Serie</ThemedText>
                  <ThemedText style={styles.valueColumn}>kg</ThemedText>
                  <ThemedText style={styles.valueColumn}>Reps</ThemedText>
                  <ThemedText style={styles.valueColumn}>RPE</ThemedText>
                  <View style={styles.saveColumn} />
                </View>

                {Array.from({ length: exercise.targetSets }, (_, setIndex) => {
                  const setNumber = setIndex + 1;
                  const key = setKey(exercise.exerciseId, setNumber);
                  const draft = drafts[key] ?? {
                    weight: '',
                    reps: '',
                    rpe: '',
                  };
                  const saved = logs.some(
                    (log) =>
                      log.exerciseId === exercise.exerciseId &&
                      log.setNumber === setNumber,
                  );
                  const isSaving = savingSetKey === key;

                  return (
                    <View
                      key={key}
                      style={[
                        styles.setRow,
                        { borderColor: theme.backgroundSelected },
                      ]}
                    >
                      <ThemedText style={styles.setColumn} type="smallBold">
                        {String(setNumber).padStart(2, '0')}
                      </ThemedText>
                      <TextInput
                        accessibilityLabel={`Peso, ${exercise.name}, serie ${setNumber}`}
                        editable={!isFinished && !isSaving}
                        keyboardType="decimal-pad"
                        onChangeText={(value) =>
                          updateDraft(key, 'weight', value)
                        }
                        placeholder="0"
                        placeholderTextColor={theme.textSecondary}
                        selectTextOnFocus
                        style={[
                          styles.input,
                          styles.valueColumn,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundElement,
                          },
                        ]}
                        value={draft.weight}
                      />
                      <TextInput
                        accessibilityLabel={`Repeticiones, ${exercise.name}, serie ${setNumber}`}
                        editable={!isFinished && !isSaving}
                        keyboardType="number-pad"
                        onChangeText={(value) =>
                          updateDraft(key, 'reps', value)
                        }
                        placeholder={String(exercise.targetReps)}
                        placeholderTextColor={theme.textSecondary}
                        selectTextOnFocus
                        style={[
                          styles.input,
                          styles.valueColumn,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundElement,
                          },
                        ]}
                        value={draft.reps}
                      />
                      <TextInput
                        accessibilityLabel={`RPE, ${exercise.name}, serie ${setNumber}`}
                        editable={!isFinished && !isSaving}
                        keyboardType="decimal-pad"
                        onChangeText={(value) => updateDraft(key, 'rpe', value)}
                        placeholder="-"
                        placeholderTextColor={theme.textSecondary}
                        selectTextOnFocus
                        style={[
                          styles.input,
                          styles.valueColumn,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundElement,
                          },
                        ]}
                        value={draft.rpe}
                      />
                      <View style={styles.saveColumn}>
                        {isFinished ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            {saved ? 'OK' : ''}
                          </ThemedText>
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${saved ? 'Actualizar' : 'Guardar'} serie ${setNumber}`}
                            disabled={isSaving || savingSetKey !== null}
                            onPress={() =>
                              void saveSet(exercise.exerciseId, setNumber)
                            }
                            style={({ pressed }) => [
                              styles.saveButton,
                              {
                                backgroundColor: saved
                                  ? theme.backgroundSelected
                                  : theme.text,
                                opacity: pressed || isSaving ? 0.72 : 1,
                              },
                            ]}
                          >
                            {isSaving ? (
                              <ActivityIndicator
                                color={saved ? theme.text : theme.background}
                                size="small"
                              />
                            ) : (
                              <ThemedText
                                style={{
                                  color: saved ? theme.text : theme.background,
                                }}
                                type="smallBold"
                              >
                                {saved ? 'OK' : 'Guardar'}
                              </ThemedText>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}

          {isFinished ? (
            <View style={styles.finishedMessage}>
              <ThemedText type="smallBold">Sesión finalizada</ThemedText>
              <ThemedText themeColor="textSecondary">
                Las series registradas quedaron guardadas en tu historial.
              </ThemedText>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={finishing}
              onPress={() => void finishSession()}
              style={({ pressed }) => [
                styles.finishButton,
                {
                  backgroundColor: theme.text,
                  opacity: pressed || finishing ? 0.72 : 1,
                },
              ]}
            >
              {finishing ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <ThemedText
                  type="smallBold"
                  style={{ color: theme.background }}
                >
                  Finalizar sesión
                </ThemedText>
              )}
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  sessionHeading: { gap: 7 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 29, fontWeight: '800', lineHeight: 35 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 5,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  errorBox: {
    gap: 6,
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#fce9e6',
  },
  errorText: { color: '#a93226', fontSize: 14 },
  actionText: { fontWeight: '700', textDecorationLine: 'underline' },
  emptyState: { paddingVertical: 30, gap: 10 },
  exerciseSection: { gap: 9 },
  exerciseHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  exerciseNumber: { width: 27, fontSize: 12, fontVariant: ['tabular-nums'] },
  exerciseCopy: { flex: 1, gap: 3 },
  exerciseName: { fontSize: 18, fontWeight: '800' },
  columnLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 2,
  },
  setColumn: { width: 34, textAlign: 'center', fontSize: 12 },
  valueColumn: { flex: 1, minWidth: 0, textAlign: 'center', fontSize: 13 },
  saveColumn: { width: 58, alignItems: 'flex-end' },
  setRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  input: {
    height: 38,
    minWidth: 0,
    borderRadius: 5,
    paddingHorizontal: 5,
    fontSize: 14,
  },
  saveButton: {
    minWidth: 54,
    height: 34,
    paddingHorizontal: 7,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButton: {
    minHeight: 50,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  finishedMessage: { gap: 5, paddingVertical: 12 },
  notFoundTitle: { textAlign: 'center' },
});
