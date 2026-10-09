import type { AppDatabase } from './client';
import { exercises } from './schema';

const commonExercises = [
  { name: 'Sentadilla', muscleGroup: 'Piernas' },
  { name: 'Press de banca', muscleGroup: 'Pecho' },
  { name: 'Peso muerto', muscleGroup: 'Espalda' },
  { name: 'Press militar', muscleGroup: 'Hombros' },
  { name: 'Dominadas', muscleGroup: 'Espalda' },
  { name: 'Remo con barra', muscleGroup: 'Espalda' },
  { name: 'Zancadas', muscleGroup: 'Piernas' },
  { name: 'Press inclinado con mancuernas', muscleGroup: 'Pecho' },
  { name: 'Jalón al pecho', muscleGroup: 'Espalda' },
  { name: 'Remo sentado', muscleGroup: 'Espalda' },
  { name: 'Elevaciones laterales', muscleGroup: 'Hombros' },
  { name: 'Curl de bíceps', muscleGroup: 'Brazos' },
  { name: 'Extensión de tríceps en polea', muscleGroup: 'Brazos' },
  { name: 'Hip thrust', muscleGroup: 'Glúteos' },
  { name: 'Peso muerto rumano', muscleGroup: 'Piernas' },
];

export async function seedExercises(database: AppDatabase) {
  await database
    .insert(exercises)
    .values(commonExercises)
    .onConflictDoNothing();
}
