import { asc, eq } from 'drizzle-orm';

import type { AppDatabase } from '../client';
import { exercises, routineDayExercises } from '../schema';

export function getRoutineDayExercises(
  database: AppDatabase,
  routineDayId: number,
) {
  return database
    .select({
      id: routineDayExercises.id,
      routineDayId: routineDayExercises.routineDayId,
      exerciseId: routineDayExercises.exerciseId,
      targetSets: routineDayExercises.targetSets,
      targetReps: routineDayExercises.targetReps,
      sortOrder: routineDayExercises.sortOrder,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
    })
    .from(routineDayExercises)
    .innerJoin(exercises, eq(routineDayExercises.exerciseId, exercises.id))
    .where(eq(routineDayExercises.routineDayId, routineDayId))
    .orderBy(asc(routineDayExercises.sortOrder));
}

export async function addExerciseToRoutineDay(
  database: AppDatabase,
  input: {
    routineDayId: number;
    exerciseId: number;
    targetSets: number;
    targetReps: number;
    sortOrder: number;
  },
) {
  const [created] = await database
    .insert(routineDayExercises)
    .values(input)
    .returning();
  return created;
}

export async function updateRoutineDayExercise(
  database: AppDatabase,
  id: number,
  updates: Partial<
    Pick<
      typeof routineDayExercises.$inferInsert,
      'targetSets' | 'targetReps' | 'sortOrder'
    >
  >,
) {
  const [updated] = await database
    .update(routineDayExercises)
    .set(updates)
    .where(eq(routineDayExercises.id, id))
    .returning();
  return updated;
}

export async function deleteRoutineDayExercise(
  database: AppDatabase,
  id: number,
) {
  await database
    .delete(routineDayExercises)
    .where(eq(routineDayExercises.id, id));
}
