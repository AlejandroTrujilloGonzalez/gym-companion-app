import { asc, eq } from 'drizzle-orm';

import type { AppDatabase } from '../client';
import { exercises, type NewExercise } from '../schema';

export function getExercises(database: AppDatabase) {
  return database.select().from(exercises).orderBy(asc(exercises.name));
}

export async function getExerciseById(database: AppDatabase, id: number) {
  const [exercise] = await database
    .select()
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1);

  return exercise;
}

export async function createExercise(
  database: AppDatabase,
  exercise: Pick<NewExercise, 'name'> &
    Partial<Pick<NewExercise, 'muscleGroup' | 'notes'>>,
) {
  const [created] = await database
    .insert(exercises)
    .values(exercise)
    .returning();
  return created;
}

export async function updateExercise(
  database: AppDatabase,
  id: number,
  updates: Partial<Pick<NewExercise, 'name' | 'muscleGroup' | 'notes'>>,
) {
  const [updated] = await database
    .update(exercises)
    .set(updates)
    .where(eq(exercises.id, id))
    .returning();

  return updated;
}

export async function deleteExercise(database: AppDatabase, id: number) {
  await database.delete(exercises).where(eq(exercises.id, id));
}
