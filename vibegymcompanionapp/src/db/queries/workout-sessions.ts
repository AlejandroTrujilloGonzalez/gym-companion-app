import { and, asc, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm';

import type { AppDatabase } from '../client';
import { routineDays, routines, setLogs, workoutSessions } from '../schema';

export function getTrainingDays(database: AppDatabase) {
  return database
    .select({
      id: routineDays.id,
      name: routineDays.name,
      dayOrder: routineDays.dayOrder,
      routineName: routines.name,
    })
    .from(routineDays)
    .innerJoin(routines, eq(routineDays.routineId, routines.id))
    .orderBy(asc(routines.createdAt), asc(routineDays.dayOrder));
}

export function getActiveWorkoutSessions(database: AppDatabase) {
  return database
    .select({
      id: workoutSessions.id,
      routineDayId: workoutSessions.routineDayId,
      startedAt: workoutSessions.startedAt,
      dayName: routineDays.name,
      routineName: routines.name,
    })
    .from(workoutSessions)
    .innerJoin(routineDays, eq(workoutSessions.routineDayId, routineDays.id))
    .innerJoin(routines, eq(routineDays.routineId, routines.id))
    .where(isNull(workoutSessions.finishedAt))
    .orderBy(desc(workoutSessions.startedAt));
}

export async function getOrCreateWorkoutSession(
  database: AppDatabase,
  routineDayId: number,
) {
  const [activeSession] = await database
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.routineDayId, routineDayId),
        isNull(workoutSessions.finishedAt),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1);

  if (activeSession) return activeSession;

  const [created] = await database
    .insert(workoutSessions)
    .values({ routineDayId })
    .returning();
  return created;
}

export async function getWorkoutSessionDetails(
  database: AppDatabase,
  sessionId: number,
) {
  const [session] = await database
    .select({
      id: workoutSessions.id,
      routineDayId: workoutSessions.routineDayId,
      startedAt: workoutSessions.startedAt,
      finishedAt: workoutSessions.finishedAt,
      dayName: routineDays.name,
      routineName: routines.name,
    })
    .from(workoutSessions)
    .innerJoin(routineDays, eq(workoutSessions.routineDayId, routineDays.id))
    .innerJoin(routines, eq(routineDays.routineId, routines.id))
    .where(eq(workoutSessions.id, sessionId))
    .limit(1);

  return session;
}

export function getWorkoutSetLogs(database: AppDatabase, sessionId: number) {
  return database
    .select()
    .from(setLogs)
    .where(eq(setLogs.sessionId, sessionId))
    .orderBy(asc(setLogs.exerciseId), asc(setLogs.setNumber));
}

export async function getPreviousWorkoutSetLogs(
  database: AppDatabase,
  exerciseId: number,
  currentSessionId: number,
) {
  const previousLogs = await database
    .select({
      sessionId: setLogs.sessionId,
      setNumber: setLogs.setNumber,
      weight: setLogs.weight,
      reps: setLogs.reps,
      rpe: setLogs.rpe,
    })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(
      and(
        eq(setLogs.exerciseId, exerciseId),
        ne(workoutSessions.id, currentSessionId),
        isNotNull(workoutSessions.finishedAt),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt), asc(setLogs.setNumber));

  const previousSessionId = previousLogs[0]?.sessionId;
  return previousLogs.filter((log) => log.sessionId === previousSessionId);
}

export async function saveWorkoutSet(
  database: AppDatabase,
  input: {
    sessionId: number;
    exerciseId: number;
    setNumber: number;
    weight: number;
    reps: number;
    rpe: number | null;
  },
) {
  const [existing] = await database
    .select({ id: setLogs.id })
    .from(setLogs)
    .where(
      and(
        eq(setLogs.sessionId, input.sessionId),
        eq(setLogs.exerciseId, input.exerciseId),
        eq(setLogs.setNumber, input.setNumber),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await database
      .update(setLogs)
      .set({ weight: input.weight, reps: input.reps, rpe: input.rpe })
      .where(eq(setLogs.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await database.insert(setLogs).values(input).returning();
  return created;
}

export async function finishWorkoutSession(
  database: AppDatabase,
  sessionId: number,
) {
  const [finished] = await database
    .update(workoutSessions)
    .set({ finishedAt: new Date() })
    .where(
      and(
        eq(workoutSessions.id, sessionId),
        isNull(workoutSessions.finishedAt),
      ),
    )
    .returning();

  return finished;
}
