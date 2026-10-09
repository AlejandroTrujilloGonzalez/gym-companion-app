import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const createdAt = (name: string) =>
  integer(name, { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: createdAt('created_at'),
});

export const routineDays = sqliteTable(
  'routine_days',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineId: integer('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    dayOrder: integer('day_order').notNull(),
  },
  (table) => [
    index('routine_days_routine_id_idx').on(table.routineId),
    uniqueIndex('routine_days_routine_order_unique').on(
      table.routineId,
      table.dayOrder,
    ),
  ],
);

export const exercises = sqliteTable(
  'exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    muscleGroup: text('muscle_group'),
    notes: text('notes'),
  },
  (table) => [uniqueIndex('exercises_name_unique').on(table.name)],
);

export const routineDayExercises = sqliteTable(
  'routine_day_exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineDayId: integer('routine_day_id')
      .notNull()
      .references(() => routineDays.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    targetSets: integer('target_sets').notNull(),
    targetReps: integer('target_reps').notNull(),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [
    index('routine_day_exercises_day_id_idx').on(table.routineDayId),
    index('routine_day_exercises_exercise_id_idx').on(table.exerciseId),
  ],
);

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineDayId: integer('routine_day_id')
      .notNull()
      .references(() => routineDays.id, { onDelete: 'cascade' }),
    startedAt: createdAt('started_at'),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('workout_sessions_routine_day_id_idx').on(table.routineDayId),
  ],
);

export const setLogs = sqliteTable(
  'set_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    weight: real('weight').notNull(),
    reps: integer('reps').notNull(),
    rpe: real('rpe'),
    createdAt: createdAt('created_at'),
  },
  (table) => [
    index('set_logs_session_id_idx').on(table.sessionId),
    index('set_logs_exercise_id_idx').on(table.exerciseId),
  ],
);

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;
export type RoutineDay = typeof routineDays.$inferSelect;
export type NewRoutineDay = typeof routineDays.$inferInsert;
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type RoutineDayExercise = typeof routineDayExercises.$inferSelect;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
