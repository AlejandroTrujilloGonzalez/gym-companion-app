import { asc, eq } from 'drizzle-orm';

import type { AppDatabase } from '../client';
import { routineDays, type NewRoutineDay } from '../schema';

export function getRoutineDays(database: AppDatabase, routineId: number) {
  return database
    .select()
    .from(routineDays)
    .where(eq(routineDays.routineId, routineId))
    .orderBy(asc(routineDays.dayOrder));
}

export async function getRoutineDayById(database: AppDatabase, id: number) {
  const [day] = await database
    .select()
    .from(routineDays)
    .where(eq(routineDays.id, id))
    .limit(1);

  return day;
}

export async function createRoutineDay(
  database: AppDatabase,
  day: Pick<NewRoutineDay, 'routineId' | 'name' | 'dayOrder'>,
) {
  const [created] = await database.insert(routineDays).values(day).returning();
  return created;
}

export async function updateRoutineDay(
  database: AppDatabase,
  id: number,
  updates: Partial<Pick<NewRoutineDay, 'name' | 'dayOrder'>>,
) {
  const [updated] = await database
    .update(routineDays)
    .set(updates)
    .where(eq(routineDays.id, id))
    .returning();

  return updated;
}

export async function deleteRoutineDay(database: AppDatabase, id: number) {
  await database.delete(routineDays).where(eq(routineDays.id, id));
}
