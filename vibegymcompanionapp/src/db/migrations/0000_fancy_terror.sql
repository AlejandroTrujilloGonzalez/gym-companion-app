CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`muscle_group` text,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_name_unique` ON `exercises` (`name`);--> statement-breakpoint
CREATE TABLE `routine_day_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_day_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`target_sets` integer NOT NULL,
	`target_reps` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`routine_day_id`) REFERENCES `routine_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `routine_day_exercises_day_id_idx` ON `routine_day_exercises` (`routine_day_id`);--> statement-breakpoint
CREATE INDEX `routine_day_exercises_exercise_id_idx` ON `routine_day_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `routine_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer NOT NULL,
	`name` text NOT NULL,
	`day_order` integer NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `routine_days_routine_id_idx` ON `routine_days` (`routine_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `routine_days_routine_order_unique` ON `routine_days` (`routine_id`,`day_order`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `set_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`set_number` integer NOT NULL,
	`weight` real NOT NULL,
	`reps` integer NOT NULL,
	`rpe` real,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `set_logs_session_id_idx` ON `set_logs` (`session_id`);--> statement-breakpoint
CREATE INDEX `set_logs_exercise_id_idx` ON `set_logs` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_day_id` integer NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`routine_day_id`) REFERENCES `routine_days`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_sessions_routine_day_id_idx` ON `workout_sessions` (`routine_day_id`);