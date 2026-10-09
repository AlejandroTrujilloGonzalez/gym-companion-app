import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/db/provider';
import { getExercises } from '@/db/queries/exercises';
import {
  addExerciseToRoutineDay,
  deleteRoutineDayExercise,
  getRoutineDayExercises,
  updateRoutineDayExercise,
} from '@/db/queries/routine-day-exercises';
import {
  createRoutineDay,
  deleteRoutineDay,
  getRoutineDays,
  moveRoutineDay,
  updateRoutineDay,
} from '@/db/queries/routine-days';
import {
  deleteRoutine,
  getRoutineById,
  updateRoutine,
} from '@/db/queries/routines';
import { useTheme } from '@/hooks/use-theme';

type ExerciseRows = Awaited<ReturnType<typeof getRoutineDayExercises>>;
type DayRows = Awaited<ReturnType<typeof getRoutineDays>>;
type CatalogRows = Awaited<ReturnType<typeof getExercises>>;
type RoutineDayData = { day: DayRows[number]; exercises: ExerciseRows };
type TargetDraft = { sets: string; reps: string };

export default function RoutineDetailScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const routineId = Number(routeId);
  const [routine, setRoutine] =
    useState<Awaited<ReturnType<typeof getRoutineById>>>();
  const [days, setDays] = useState<RoutineDayData[]>([]);
  const [catalog, setCatalog] = useState<CatalogRows>([]);
  const [routineName, setRoutineName] = useState('');
  const [description, setDescription] = useState('');
  const [dayNames, setDayNames] = useState<Record<number, string>>({});
  const [targetDrafts, setTargetDrafts] = useState<Record<number, TargetDraft>>(
    {},
  );
  const [newDayName, setNewDayName] = useState('');
  const [addingDayId, setAddingDayId] = useState<number | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(
    null,
  );
  const [newTargetSets, setNewTargetSets] = useState('3');
  const [newTargetReps, setNewTargetReps] = useState('8');
  const [confirmation, setConfirmation] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutine = useCallback(async () => {
    const [routineResult, dayRows, exerciseCatalog] = await Promise.all([
      getRoutineById(database, routineId),
      getRoutineDays(database, routineId),
      getExercises(database),
    ]);
    const dayData = await Promise.all(
      dayRows.map(async (day) => ({
        day,
        exercises: await getRoutineDayExercises(database, day.id),
      })),
    );

    return { routineResult, dayRows, exerciseCatalog, dayData };
  }, [database, routineId]);

  const applyRoutineData = useCallback(
    (data: Awaited<ReturnType<typeof fetchRoutine>>) => {
      const { routineResult, dayRows, exerciseCatalog, dayData } = data;
      setRoutine(routineResult);
      setDays(dayData);
      setCatalog(exerciseCatalog);
      setRoutineName(routineResult?.name ?? '');
      setDescription(routineResult?.description ?? '');
      setDayNames(Object.fromEntries(dayRows.map((day) => [day.id, day.name])));
      setTargetDrafts(
        Object.fromEntries(
          dayData.flatMap(({ exercises }) =>
            exercises.map((exercise) => [
              exercise.id,
              {
                sets: String(exercise.targetSets),
                reps: String(exercise.targetReps),
              },
            ]),
          ),
        ),
      );
    },
    [],
  );

  const refreshRoutine = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyRoutineData(await fetchRoutine());
    } catch {
      setError(
        'No se pudo cargar la rutina. Comprueba tus datos e inténtalo de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  }, [applyRoutineData, fetchRoutine]);

  useEffect(() => {
    let active = true;
    fetchRoutine()
      .then((data) => {
        if (active) applyRoutineData(data);
      })
      .catch(() => {
        if (active) {
          setError(
            'No se pudo cargar la rutina. Comprueba tus datos e inténtalo de nuevo.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyRoutineData, fetchRoutine]);

  const filteredExercises = useMemo(() => {
    const search = exerciseSearch.trim().toLocaleLowerCase();
    return catalog.filter((exercise) =>
      `${exercise.name} ${exercise.muscleGroup ?? ''}`
        .toLocaleLowerCase()
        .includes(search),
    );
  }, [catalog, exerciseSearch]);

  async function mutate(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await action();
      applyRoutineData(await fetchRoutine());
    } catch {
      setError('No se guardaron los cambios. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function saveRoutineDetails() {
    if (!routineName.trim()) {
      setError('El nombre de la rutina no puede estar vacío.');
      return;
    }
    await mutate(async () => {
      await updateRoutine(database, routineId, {
        name: routineName.trim(),
        description: description.trim() || null,
      });
    });
  }

  async function addDay() {
    const name = newDayName.trim();
    if (!name) {
      setError('Escribe un nombre para el día.');
      return;
    }
    await mutate(async () => {
      const nextOrder =
        days.reduce(
          (maximum, item) => Math.max(maximum, item.day.dayOrder),
          -1,
        ) + 1;
      await createRoutineDay(database, {
        routineId,
        name,
        dayOrder: nextOrder,
      });
      setNewDayName('');
    });
  }

  async function addExercise(dayId: number) {
    const sets = Number(newTargetSets);
    const reps = Number(newTargetReps);
    if (
      !selectedExerciseId ||
      !Number.isInteger(sets) ||
      sets < 1 ||
      !Number.isInteger(reps) ||
      reps < 1
    ) {
      setError(
        'Selecciona un ejercicio e indica series y repeticiones válidas.',
      );
      return;
    }
    const existing =
      days.find((item) => item.day.id === dayId)?.exercises ?? [];
    if (
      existing.some((exercise) => exercise.exerciseId === selectedExerciseId)
    ) {
      setError('Ese ejercicio ya está añadido a este día.');
      return;
    }

    await mutate(async () => {
      await addExerciseToRoutineDay(database, {
        routineDayId: dayId,
        exerciseId: selectedExerciseId,
        targetSets: sets,
        targetReps: reps,
        sortOrder:
          existing.reduce(
            (maximum, exercise) => Math.max(maximum, exercise.sortOrder),
            -1,
          ) + 1,
      });
      setAddingDayId(null);
      setExerciseSearch('');
      setSelectedExerciseId(null);
    });
  }

  async function moveExercise(
    dayId: number,
    exerciseId: number,
    direction: -1 | 1,
  ) {
    const exerciseRows =
      days.find((item) => item.day.id === dayId)?.exercises ?? [];
    const index = exerciseRows.findIndex(
      (exercise) => exercise.id === exerciseId,
    );
    const neighbor = exerciseRows[index + direction];
    if (index < 0 || !neighbor) return;

    await mutate(async () => {
      await Promise.all([
        updateRoutineDayExercise(database, exerciseId, {
          sortOrder: neighbor.sortOrder,
        }),
        updateRoutineDayExercise(database, neighbor.id, {
          sortOrder: exerciseRows[index].sortOrder,
        }),
      ]);
    });
  }

  function askToDelete(message: string, onConfirm: () => Promise<void>) {
    setConfirmation({ message, onConfirm });
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary">Cargando rutina...</ThemedText>
      </ThemedView>
    );
  }

  if (!routine) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle" style={styles.notFoundTitle}>
          Rutina no disponible
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {error ?? 'Puede que se haya eliminado.'}
        </ThemedText>
        {error && (
          <Pressable onPress={() => void refreshRoutine()}>
            <ThemedText style={styles.actionText}>Reintentar</ThemedText>
          </Pressable>
        )}
        <Pressable onPress={() => router.replace('/routines')}>
          <ThemedText style={styles.actionText}>Volver a rutinas</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

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
          <ThemedText style={styles.eyebrow} themeColor="textSecondary">
            PLAN DE ENTRENAMIENTO
          </ThemedText>
          <ThemedText style={styles.title}>{routine.name}</ThemedText>

          <View style={styles.formSection}>
            <ThemedText type="smallBold">Datos de la rutina</ThemedText>
            <TextInput
              accessibilityLabel="Nombre de la rutina"
              maxLength={60}
              onChangeText={setRoutineName}
              placeholder="Nombre"
              style={inputStyle}
              value={routineName}
            />
            <TextInput
              accessibilityLabel="Descripción de la rutina"
              maxLength={180}
              multiline
              onChangeText={setDescription}
              placeholder="Descripción opcional"
              style={[inputStyle, styles.multiline]}
              value={description}
            />
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void saveRoutineDetails()}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Guardar datos</ThemedText>
            </Pressable>
          </View>

          <View style={styles.daysHeading}>
            <View style={styles.headingCopy}>
              <ThemedText style={styles.sectionTitle}>Días</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {days.length} {days.length === 1 ? 'día' : 'días'} en esta
                rutina
              </ThemedText>
            </View>
            <ThemedText style={styles.dayCount}>
              {String(days.length).padStart(2, '0')}
            </ThemedText>
          </View>

          {days.map(({ day, exercises }, dayIndex) => (
            <View
              key={day.id}
              style={[
                styles.dayCard,
                { borderColor: theme.backgroundSelected },
              ]}
            >
              <View style={styles.dayHeader}>
                <ThemedText style={styles.dayNumber} themeColor="textSecondary">
                  {String(dayIndex + 1).padStart(2, '0')}
                </ThemedText>
                <TextInput
                  accessibilityLabel={`Nombre del día ${dayIndex + 1}`}
                  maxLength={40}
                  onChangeText={(value) =>
                    setDayNames((current) => ({ ...current, [day.id]: value }))
                  }
                  style={[styles.dayNameInput, { color: theme.text }]}
                  value={dayNames[day.id] ?? day.name}
                />
                <View style={styles.iconActions}>
                  <IconAction
                    label="Mover día arriba"
                    disabled={dayIndex === 0 || saving}
                    name={{
                      ios: 'arrow.up',
                      android: 'arrow_upward',
                      web: 'arrow_upward',
                    }}
                    onPress={() =>
                      void mutate(() =>
                        moveRoutineDay(database, routineId, day.id, -1),
                      )
                    }
                    tintColor={theme.textSecondary}
                  />
                  <IconAction
                    label="Mover día abajo"
                    disabled={dayIndex === days.length - 1 || saving}
                    name={{
                      ios: 'arrow.down',
                      android: 'arrow_downward',
                      web: 'arrow_downward',
                    }}
                    onPress={() =>
                      void mutate(() =>
                        moveRoutineDay(database, routineId, day.id, 1),
                      )
                    }
                    tintColor={theme.textSecondary}
                  />
                  <IconAction
                    label="Eliminar día"
                    name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                    onPress={() =>
                      askToDelete(
                        `¿Eliminar “${day.name}” y sus ejercicios?`,
                        async () => {
                          await mutate(() =>
                            deleteRoutineDay(database, day.id),
                          );
                        },
                      )
                    }
                    tintColor="#c0392b"
                  />
                </View>
              </View>
              <View style={styles.dayNameActions}>
                <Pressable
                  disabled={saving}
                  onPress={() =>
                    void mutate(async () => {
                      const name = (dayNames[day.id] ?? '').trim();
                      if (!name)
                        throw new Error('El nombre del día es obligatorio.');
                      await updateRoutineDay(database, day.id, { name });
                    })
                  }
                  style={styles.smallTextButton}
                >
                  <ThemedText style={styles.actionText}>
                    Guardar nombre
                  </ThemedText>
                </Pressable>
              </View>

              {exercises.length === 0 ? (
                <ThemedText
                  style={styles.emptyExercises}
                  themeColor="textSecondary"
                >
                  Aún no hay ejercicios en este día.
                </ThemedText>
              ) : (
                <View style={styles.exerciseList}>
                  {exercises.map((exercise, exerciseIndex) => {
                    const draft = targetDrafts[exercise.id] ?? {
                      sets: String(exercise.targetSets),
                      reps: String(exercise.targetReps),
                    };
                    return (
                      <View
                        key={exercise.id}
                        style={[
                          styles.exerciseRow,
                          { borderColor: theme.backgroundSelected },
                        ]}
                      >
                        <View style={styles.exerciseTopRow}>
                          <View style={styles.exerciseCopy}>
                            <ThemedText type="smallBold">
                              {exercise.name}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {exercise.muscleGroup ?? 'Sin grupo muscular'}
                            </ThemedText>
                          </View>
                          <View style={styles.iconActions}>
                            <IconAction
                              label="Mover ejercicio arriba"
                              disabled={exerciseIndex === 0 || saving}
                              name={{
                                ios: 'arrow.up',
                                android: 'arrow_upward',
                                web: 'arrow_upward',
                              }}
                              onPress={() =>
                                void moveExercise(day.id, exercise.id, -1)
                              }
                              tintColor={theme.textSecondary}
                            />
                            <IconAction
                              label="Mover ejercicio abajo"
                              disabled={
                                exerciseIndex === exercises.length - 1 || saving
                              }
                              name={{
                                ios: 'arrow.down',
                                android: 'arrow_downward',
                                web: 'arrow_downward',
                              }}
                              onPress={() =>
                                void moveExercise(day.id, exercise.id, 1)
                              }
                              tintColor={theme.textSecondary}
                            />
                            <IconAction
                              label={`Eliminar ${exercise.name}`}
                              name={{
                                ios: 'trash',
                                android: 'delete',
                                web: 'delete',
                              }}
                              onPress={() =>
                                askToDelete(
                                  `¿Quitar ${exercise.name} de este día?`,
                                  async () => {
                                    await mutate(() =>
                                      deleteRoutineDayExercise(
                                        database,
                                        exercise.id,
                                      ),
                                    );
                                  },
                                )
                              }
                              tintColor="#c0392b"
                            />
                          </View>
                        </View>
                        <View style={styles.targetRow}>
                          <ThemedText type="small" themeColor="textSecondary">
                            Objetivo
                          </ThemedText>
                          <TextInput
                            accessibilityLabel={`Series objetivo para ${exercise.name}`}
                            keyboardType="number-pad"
                            maxLength={2}
                            onChangeText={(value) =>
                              setTargetDrafts((current) => ({
                                ...current,
                                [exercise.id]: { ...draft, sets: value },
                              }))
                            }
                            selectTextOnFocus
                            style={[
                              styles.targetInput,
                              {
                                color: theme.text,
                                backgroundColor: theme.backgroundElement,
                              },
                            ]}
                            value={draft.sets}
                          />
                          <ThemedText type="small" themeColor="textSecondary">
                            series ×
                          </ThemedText>
                          <TextInput
                            accessibilityLabel={`Repeticiones objetivo para ${exercise.name}`}
                            keyboardType="number-pad"
                            maxLength={2}
                            onChangeText={(value) =>
                              setTargetDrafts((current) => ({
                                ...current,
                                [exercise.id]: { ...draft, reps: value },
                              }))
                            }
                            selectTextOnFocus
                            style={[
                              styles.targetInput,
                              {
                                color: theme.text,
                                backgroundColor: theme.backgroundElement,
                              },
                            ]}
                            value={draft.reps}
                          />
                          <ThemedText type="small" themeColor="textSecondary">
                            reps
                          </ThemedText>
                          <Pressable
                            accessibilityRole="button"
                            disabled={saving}
                            onPress={() =>
                              void mutate(async () => {
                                const sets = Number(draft.sets);
                                const reps = Number(draft.reps);
                                if (
                                  !Number.isInteger(sets) ||
                                  sets < 1 ||
                                  !Number.isInteger(reps) ||
                                  reps < 1
                                ) {
                                  throw new Error(
                                    'Series y repeticiones deben ser mayores que cero.',
                                  );
                                }
                                await updateRoutineDayExercise(
                                  database,
                                  exercise.id,
                                  {
                                    targetSets: sets,
                                    targetReps: reps,
                                  },
                                );
                              })
                            }
                            style={styles.saveTarget}
                          >
                            <ThemedText style={styles.actionText}>
                              Guardar
                            </ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {addingDayId === day.id ? (
                <View
                  style={[
                    styles.addExercisePanel,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <View style={styles.panelHeading}>
                    <ThemedText type="smallBold">Añadir ejercicio</ThemedText>
                    <Pressable onPress={() => setAddingDayId(null)} hitSlop={8}>
                      <ThemedText themeColor="textSecondary">Cerrar</ThemedText>
                    </Pressable>
                  </View>
                  <TextInput
                    accessibilityLabel="Buscar ejercicio"
                    onChangeText={(value) => {
                      setExerciseSearch(value);
                      setSelectedExerciseId(null);
                    }}
                    placeholder="Buscar por nombre o músculo"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={exerciseSearch}
                  />
                  <ScrollView style={styles.catalogList} nestedScrollEnabled>
                    {filteredExercises.map((exercise) => {
                      const selected = selectedExerciseId === exercise.id;
                      return (
                        <Pressable
                          key={exercise.id}
                          onPress={() => setSelectedExerciseId(exercise.id)}
                          style={[
                            styles.catalogItem,
                            selected && {
                              backgroundColor: theme.backgroundSelected,
                            },
                          ]}
                        >
                          <View style={styles.exerciseCopy}>
                            <ThemedText type="smallBold">
                              {exercise.name}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {exercise.muscleGroup ?? 'Sin grupo muscular'}
                            </ThemedText>
                          </View>
                          {selected && (
                            <SymbolView
                              name={{
                                ios: 'checkmark',
                                android: 'check',
                                web: 'check',
                              }}
                              size={17}
                              tintColor={theme.text}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                    {filteredExercises.length === 0 && (
                      <ThemedText
                        style={styles.noResults}
                        themeColor="textSecondary"
                      >
                        No hay ejercicios con ese nombre.
                      </ThemedText>
                    )}
                  </ScrollView>
                  <View style={styles.newTargetRow}>
                    <TargetInput
                      label="Series"
                      value={newTargetSets}
                      onChangeText={setNewTargetSets}
                      theme={theme}
                    />
                    <TargetInput
                      label="Repeticiones"
                      value={newTargetReps}
                      onChangeText={setNewTargetReps}
                      theme={theme}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving || selectedExerciseId === null}
                    onPress={() => void addExercise(day.id)}
                    style={({ pressed }) => [
                      styles.addExerciseButton,
                      {
                        backgroundColor: theme.text,
                        opacity:
                          saving || !selectedExerciseId || pressed ? 0.55 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      type="smallBold"
                      style={{ color: theme.background }}
                    >
                      Añadir al día
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => {
                    setAddingDayId(day.id);
                    setExerciseSearch('');
                    setSelectedExerciseId(null);
                    setNewTargetSets('3');
                    setNewTargetReps('8');
                  }}
                  style={styles.addExerciseLink}
                >
                  <ThemedText style={styles.actionText}>
                    + Añadir ejercicio
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ))}

          <View style={styles.addDaySection}>
            <ThemedText type="smallBold">Añadir otro día</ThemedText>
            <View style={styles.addDayRow}>
              <TextInput
                accessibilityLabel="Nombre del nuevo día"
                maxLength={40}
                onChangeText={setNewDayName}
                onSubmitEditing={() => void addDay()}
                placeholder="Ej. Día de piernas"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  styles.newDayInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
                value={newDayName}
              />
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void addDay()}
                style={({ pressed }) => [
                  styles.addDayButton,
                  {
                    backgroundColor: theme.text,
                    opacity: saving || pressed ? 0.65 : 1,
                  },
                ]}
              >
                <ThemedText
                  type="smallBold"
                  style={{ color: theme.background }}
                >
                  Añadir
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              askToDelete(
                `¿Eliminar la rutina “${routine.name}” y todos sus días?`,
                async () => {
                  setSaving(true);
                  try {
                    await deleteRoutine(database, routineId);
                    router.replace('/routines');
                  } catch {
                    setError(
                      'No se pudo eliminar la rutina. Inténtalo de nuevo.',
                    );
                  } finally {
                    setSaving(false);
                  }
                },
              )
            }
            style={styles.deleteRoutineButton}
          >
            <ThemedText style={styles.deleteText}>Eliminar rutina</ThemedText>
          </Pressable>

          {confirmation && (
            <View
              style={[
                styles.confirmation,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="smallBold">{confirmation.message}</ThemedText>
              <View style={styles.confirmationActions}>
                <Pressable
                  onPress={() => setConfirmation(null)}
                  style={styles.confirmButton}
                >
                  <ThemedText type="smallBold">Cancelar</ThemedText>
                </Pressable>
                <Pressable
                  disabled={saving}
                  onPress={() => {
                    const confirm = confirmation.onConfirm;
                    setConfirmation(null);
                    void confirm();
                  }}
                  style={styles.confirmButton}
                >
                  <ThemedText style={styles.deleteText}>Eliminar</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {error && (
            <ThemedText accessibilityRole="alert" style={styles.error}>
              {error}
            </ThemedText>
          )}
          {saving && (
            <ThemedText type="small" themeColor="textSecondary">
              Guardando cambios...
            </ThemedText>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function IconAction({
  label,
  name,
  onPress,
  tintColor,
  disabled = false,
}: {
  label: string;
  name: NonNullable<SymbolViewProps['name']>;
  onPress: () => void;
  tintColor: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={5}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: disabled ? 0.25 : pressed ? 0.55 : 1 },
      ]}
    >
      <SymbolView name={name} size={17} tintColor={tintColor} />
    </Pressable>
  );
}

function TargetInput({
  label,
  value,
  onChangeText,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.newTargetField}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        maxLength={2}
        onChangeText={onChangeText}
        selectTextOnFocus
        style={[
          styles.targetInput,
          { color: theme.text, backgroundColor: theme.background },
        ]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 13,
  },
  notFoundTitle: { fontSize: 24, lineHeight: 30, textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  formSection: { gap: 10, paddingTop: 6, paddingBottom: 8 },
  input: {
    minHeight: 46,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  secondaryButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#88888888',
    borderRadius: 6,
  },
  pressed: { opacity: 0.65 },
  daysHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingBottom: 2,
  },
  headingCopy: { gap: 3 },
  sectionTitle: { fontSize: 24, fontWeight: '800' },
  dayCount: {
    fontSize: 30,
    fontWeight: '800',
    opacity: 0.2,
    fontVariant: ['tabular-nums'],
  },
  dayCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
    gap: 8,
  },
  dayHeader: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayNumber: { width: 24, fontSize: 12, fontVariant: ['tabular-nums'] },
  dayNameInput: { flex: 1, minHeight: 45, fontSize: 17, fontWeight: '700' },
  iconActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNameActions: {
    alignItems: 'flex-start',
    paddingLeft: 32,
    paddingBottom: 4,
  },
  smallTextButton: { paddingVertical: 3 },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  emptyExercises: { paddingHorizontal: 32, paddingVertical: 8, fontSize: 14 },
  exerciseList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#88888855',
  },
  exerciseRow: {
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  exerciseTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseCopy: { flex: 1, gap: 2 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetInput: {
    width: 45,
    minHeight: 36,
    borderRadius: 5,
    textAlign: 'center',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  saveTarget: { marginLeft: 'auto', paddingVertical: 6, paddingLeft: 6 },
  addExerciseLink: {
    minHeight: 43,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 32,
  },
  addExercisePanel: { padding: 12, gap: 10, borderRadius: 7 },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catalogList: { maxHeight: 220 },
  catalogItem: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#88888855',
  },
  noResults: { padding: 12, textAlign: 'center' },
  newTargetRow: { flexDirection: 'row', gap: 20 },
  newTargetField: { gap: 5 },
  addExerciseButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    marginTop: 2,
  },
  addDaySection: { paddingTop: 10, gap: 9 },
  addDayRow: { flexDirection: 'row', gap: 8 },
  newDayInput: { flex: 1 },
  addDayButton: {
    minWidth: 76,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  deleteRoutineButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    marginTop: 12,
  },
  deleteText: { color: '#c0392b', fontSize: 14, fontWeight: '700' },
  confirmation: { padding: 14, borderRadius: 7, gap: 12 },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  confirmButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  error: { color: '#c0392b', fontSize: 14 },
});
