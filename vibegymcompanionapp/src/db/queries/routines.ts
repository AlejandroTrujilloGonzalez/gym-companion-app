import { desc, eq } from 'drizzle-orm';

import type { AppDatabase } from '../client';
import { routines, type NewRoutine } from '../schema';

export function getRoutines(database: AppDatabase) {
  return database.select().from(routines).orderBy(desc(routines.createdAt));
}

export async function getRoutineById(database: AppDatabase, id: number) {
  const [routine] = await database
    .select()
    .from(routines)
    .where(eq(routines.id, id))
    .limit(1);

  return routine;
}

export async function createRoutine(
  database: AppDatabase,
  routine: Pick<NewRoutine, 'name'> & Partial<Pick<NewRoutine, 'description'>>,
) {
  const [created] = await database.insert(routines).values(routine).returning();
  return created;
}

export async function updateRoutine(
  database: AppDatabase,
  id: number,
  updates: Partial<Pick<NewRoutine, 'name' | 'description'>>,
) {
  const [updated] = await database
    .update(routines)
    .set(updates)
    .where(eq(routines.id, id))
    .returning();

  return updated;
}

export async function deleteRoutine(database: AppDatabase, id: number) {
  await database.delete(routines).where(eq(routines.id, id));
}
