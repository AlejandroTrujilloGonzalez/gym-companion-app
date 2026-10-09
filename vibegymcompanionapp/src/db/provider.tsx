import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/db/migrations/migrations';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';

import { createDatabase, type AppDatabase } from './client';
import { seedExercises } from './seed';

const DatabaseContext = createContext<AppDatabase | null>(null);

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName="gym-companion.db" onInit={initializeDatabase}>
      <MigratedDatabase>{children}</MigratedDatabase>
    </SQLiteProvider>
  );
}

export function useDatabase() {
  const database = useContext(DatabaseContext);

  if (!database) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }

  return database;
}

function MigratedDatabase({ children }: PropsWithChildren) {
  const sqlite = useSQLiteContext();
  const database = useMemo(() => createDatabase(sqlite), [sqlite]);
  const { success, error } = useMigrations(database, migrations);
  const [seedComplete, setSeedComplete] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success) return;

    let active = true;
    seedExercises(database)
      .then(() => {
        if (active) setSeedComplete(true);
      })
      .catch((cause: unknown) => {
        if (active) {
          setSeedError(
            cause instanceof Error
              ? cause
              : new Error('No se pudieron cargar los ejercicios.'),
          );
        }
      });

    return () => {
      active = false;
    };
  }, [database, success]);

  if (error || seedError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-base text-red-600">
          No se pudo iniciar la base de datos: {(error ?? seedError)?.message}
        </Text>
      </View>
    );
  }

  if (!success || !seedComplete) {
    return (
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator />
        <Text className="text-sm text-neutral-500">
          Preparando tus datos...
        </Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
}

async function initializeDatabase(
  database: import('expo-sqlite').SQLiteDatabase,
) {
  await database.execAsync(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;',
  );
}
