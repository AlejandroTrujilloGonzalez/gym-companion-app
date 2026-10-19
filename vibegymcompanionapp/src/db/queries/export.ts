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
