import type { AppDatabase } from '@/db/client';
import {
  exercises,
  routineDayExercises,
  routineDays,
  routines,
  setLogs,
  workoutSessions,
} from '@/db/schema';

export async function getBackupData(database: AppDatabase) {
  const [
    routineRows,
    dayRows,
    exerciseRows,
    routineExerciseRows,
    sessions,
    sets,
  ] = await Promise.all([
    database.select().from(routines),
    database.select().from(routineDays),
    database.select().from(exercises),
    database.select().from(routineDayExercises),
    database.select().from(workoutSessions),
    database.select().from(setLogs),
  ]);

  return {
    app: 'Gym Companion',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      routines: routineRows,
      routineDays: dayRows,
      exercises: exerciseRows,
      routineDayExercises: routineExerciseRows,
      workoutSessions: sessions,
      setLogs: sets,
    },
  };
}

export type BackupData = Awaited<ReturnType<typeof getBackupData>>['data'];

type BackupObject = Record<string, unknown>;

function asObject(value: unknown, path: string): BackupObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`El campo ${path} no tiene un formato válido.`);
  }
  return value as BackupObject;
}

function parseArray<T>(
  value: unknown,
  path: string,
  parseItem: (item: unknown, itemPath: string) => T,
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`El campo ${path} debe ser una lista.`);
  }
  return value.map((item, index) => parseItem(item, `${path}[${index}]`));
}

function parseInteger(value: unknown, path: string, minimum: number) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new Error(`El campo ${path} debe ser un número entero válido.`);
  }
  return value;
}

function parseNumber(value: unknown, path: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`El campo ${path} debe ser un número válido.`);
  }
  return value;
}

function parseString(value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`El campo ${path} no puede estar vacío.`);
  }
  return value;
}

function parseNullableString(value: unknown, path: string) {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`El campo ${path} no tiene un formato válido.`);
  }
  return value;
}

function parseDate(value: unknown, path: string): Date {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`La fecha ${path} no tiene un formato válido.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`La fecha ${path} no tiene un formato válido.`);
  }
  return date;
}

function parseNullableDate(value: unknown, path: string) {
  return value === null ? null : parseDate(value, path);
}

function parseNullableNumber(value: unknown, path: string) {
  return value === null ? null : parseNumber(value, path);
}

function uniqueIds<T extends { id: number }>(rows: T[], path: string) {
  const ids = new Set<number>();
  for (const row of rows) {
    if (ids.has(row.id)) {
      throw new Error(`Hay identificadores duplicados en ${path}.`);
    }
    ids.add(row.id);
  }
  return ids;
}

function requireReference(ids: Set<number>, id: number, path: string) {
  if (!ids.has(id)) {
    throw new Error(`La referencia ${path} no existe en la copia.`);
  }
}

export function parseBackupData(contents: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('El archivo no contiene un JSON válido.');
  }

  const root = asObject(parsed, 'raíz');
  if (root.app !== 'Gym Companion' || root.schemaVersion !== 1) {
    throw new Error('El archivo no es una copia compatible de Gym Companion.');
  }
  const data = asObject(root.data, 'data');

  const routinesData = parseArray(data.routines, 'rutinas', (item, path) => {
    const row = asObject(item, path);
    return {
      id: parseInteger(row.id, `${path}.id`, 1),
      name: parseString(row.name, `${path}.name`),
      description: parseNullableString(row.description, `${path}.description`),
      createdAt: parseDate(row.createdAt, `${path}.createdAt`),
    };
  });
  const exerciseData = parseArray(
    data.exercises,
    'ejercicios',
    (item, path) => {
      const row = asObject(item, path);
      return {
        id: parseInteger(row.id, `${path}.id`, 1),
        name: parseString(row.name, `${path}.name`),
        muscleGroup: parseNullableString(
          row.muscleGroup,
          `${path}.muscleGroup`,
        ),
        notes: parseNullableString(row.notes, `${path}.notes`),
      };
    },
  );
  const dayData = parseArray(data.routineDays, 'días', (item, path) => {
    const row = asObject(item, path);
    return {
      id: parseInteger(row.id, `${path}.id`, 1),
      routineId: parseInteger(row.routineId, `${path}.routineId`, 1),
      name: parseString(row.name, `${path}.name`),
      dayOrder: parseInteger(row.dayOrder, `${path}.dayOrder`, 0),
    };
  });
  const routineExerciseData = parseArray(
    data.routineDayExercises,
    'ejercicios de rutina',
    (item, path) => {
      const row = asObject(item, path);
      return {
        id: parseInteger(row.id, `${path}.id`, 1),
        routineDayId: parseInteger(row.routineDayId, `${path}.routineDayId`, 1),
        exerciseId: parseInteger(row.exerciseId, `${path}.exerciseId`, 1),
        targetSets: parseInteger(row.targetSets, `${path}.targetSets`, 1),
        targetReps: parseInteger(row.targetReps, `${path}.targetReps`, 1),
        sortOrder: parseInteger(row.sortOrder, `${path}.sortOrder`, 0),
      };
    },
  );
  const sessionData = parseArray(
    data.workoutSessions,
    'entrenamientos',
    (item, path) => {
      const row = asObject(item, path);
      return {
        id: parseInteger(row.id, `${path}.id`, 1),
        routineDayId: parseInteger(row.routineDayId, `${path}.routineDayId`, 1),
        startedAt: parseDate(row.startedAt, `${path}.startedAt`),
        finishedAt: parseNullableDate(row.finishedAt, `${path}.finishedAt`),
      };
    },
  );
  const setData = parseArray(data.setLogs, 'series', (item, path) => {
    const row = asObject(item, path);
    return {
      id: parseInteger(row.id, `${path}.id`, 1),
      sessionId: parseInteger(row.sessionId, `${path}.sessionId`, 1),
      exerciseId: parseInteger(row.exerciseId, `${path}.exerciseId`, 1),
      setNumber: parseInteger(row.setNumber, `${path}.setNumber`, 1),
      weight: parseNumber(row.weight, `${path}.weight`),
      reps: parseInteger(row.reps, `${path}.reps`, 1),
      rpe: parseNullableNumber(row.rpe, `${path}.rpe`),
      createdAt: parseDate(row.createdAt, `${path}.createdAt`),
    };
  });

  const routineIds = uniqueIds(routinesData, 'rutinas');
  const dayIds = uniqueIds(dayData, 'días');
  const exerciseIds = uniqueIds(exerciseData, 'ejercicios');
  uniqueIds(routineExerciseData, 'ejercicios de rutina');
  const sessionIds = uniqueIds(sessionData, 'entrenamientos');
  uniqueIds(setData, 'series');

  const exerciseNames = new Set<string>();
  for (const exercise of exerciseData) {
    if (exerciseNames.has(exercise.name)) {
      throw new Error('Hay nombres de ejercicio duplicados en la copia.');
    }
    exerciseNames.add(exercise.name);
  }

  const routineDayOrders = new Set<string>();
  for (const day of dayData) {
    requireReference(routineIds, day.routineId, 'de rutina');
    const key = `${day.routineId}:${day.dayOrder}`;
    if (routineDayOrders.has(key)) {
      throw new Error('Hay órdenes de día duplicados en una rutina.');
    }
    routineDayOrders.add(key);
  }
  for (const routineExercise of routineExerciseData) {
    requireReference(dayIds, routineExercise.routineDayId, 'de día');
    requireReference(exerciseIds, routineExercise.exerciseId, 'de ejercicio');
  }
  for (const session of sessionData) {
    requireReference(dayIds, session.routineDayId, 'de entrenamiento');
  }
  for (const set of setData) {
    requireReference(sessionIds, set.sessionId, 'de serie');
    requireReference(exerciseIds, set.exerciseId, 'de serie');
  }

  return {
    routines: routinesData,
    routineDays: dayData,
    exercises: exerciseData,
    routineDayExercises: routineExerciseData,
    workoutSessions: sessionData,
    setLogs: setData,
  };
}

export async function restoreBackup(database: AppDatabase, data: BackupData) {
  await database.transaction(async (transaction) => {
    await transaction.delete(setLogs);
    await transaction.delete(workoutSessions);
    await transaction.delete(routineDayExercises);
    await transaction.delete(routineDays);
    await transaction.delete(routines);
    await transaction.delete(exercises);

    if (data.routines.length) {
      await transaction.insert(routines).values(data.routines);
    }
    if (data.exercises.length) {
      await transaction.insert(exercises).values(data.exercises);
    }
    if (data.routineDays.length) {
      await transaction.insert(routineDays).values(data.routineDays);
    }
    if (data.routineDayExercises.length) {
      await transaction
        .insert(routineDayExercises)
        .values(data.routineDayExercises);
    }
    if (data.workoutSessions.length) {
      await transaction.insert(workoutSessions).values(data.workoutSessions);
    }
    if (data.setLogs.length) {
      await transaction.insert(setLogs).values(data.setLogs);
    }
  });
}
