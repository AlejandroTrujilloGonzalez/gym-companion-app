import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';

import type { AppDatabase } from '../client';
import {
  exercises,
  setLogs,
  workoutSessions,
  routineDays,
  routines,
} from '../schema';

export function getExerciseProgressSummaries(database: AppDatabase) {
  return database
    .select({
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      personalRecord: sql<number>`max(${setLogs.weight})`,
      sessionCount: sql<number>`count(distinct ${setLogs.sessionId})`,
    })
    .from(setLogs)
    .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(isNotNull(workoutSessions.finishedAt))
    .groupBy(exercises.id, exercises.name, exercises.muscleGroup)
    .orderBy(asc(exercises.name));
}

export async function getExerciseHistory(
  database: AppDatabase,
  exerciseId: number,
) {
  const rows = await database
    .select({
      sessionId: workoutSessions.id,
      startedAt: workoutSessions.startedAt,
      finishedAt: workoutSessions.finishedAt,
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
        isNotNull(workoutSessions.finishedAt),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt), asc(setLogs.setNumber));

  const sessions = new Map<
    number,
    {
      sessionId: number;
      startedAt: Date;
      finishedAt: Date | null;
      maxWeight: number;
      volume: number;
      sets: {
        setNumber: number;
        weight: number;
        reps: number;
        rpe: number | null;
      }[];
    }
  >();

  for (const row of rows) {
    let session = sessions.get(row.sessionId);
    if (!session) {
      session = {
        sessionId: row.sessionId,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        maxWeight: 0,
        volume: 0,
        sets: [],
      };
      sessions.set(row.sessionId, session);
    }

    session.maxWeight = Math.max(session.maxWeight, row.weight);
    session.volume += row.weight * row.reps;
    session.sets.push({
      setNumber: row.setNumber,
      weight: row.weight,
      reps: row.reps,
      rpe: row.rpe,
    });
  }

  return [...sessions.values()];
}

export function getWorkoutVolumeHistory(database: AppDatabase) {
  return database
    .select({
      sessionId: workoutSessions.id,
      routineName: routines.name,
      dayName: routineDays.name,
      startedAt: workoutSessions.startedAt,
      finishedAt: workoutSessions.finishedAt,
      volume: sql<number>`coalesce(sum(${setLogs.weight} * ${setLogs.reps}), 0)`,
      setCount: sql<number>`count(${setLogs.id})`,
      exerciseCount: sql<number>`count(distinct ${setLogs.exerciseId})`,
    })
    .from(workoutSessions)
    .innerJoin(routineDays, eq(workoutSessions.routineDayId, routineDays.id))
    .innerJoin(routines, eq(routineDays.routineId, routines.id))
    .leftJoin(setLogs, eq(workoutSessions.id, setLogs.sessionId))
    .where(isNotNull(workoutSessions.finishedAt))
    .groupBy(
      workoutSessions.id,
      routines.name,
      routineDays.name,
      workoutSessions.startedAt,
      workoutSessions.finishedAt,
    )
    .orderBy(desc(workoutSessions.startedAt));
}
