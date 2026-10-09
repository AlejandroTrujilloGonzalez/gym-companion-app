import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/db/provider';
import {
  getActiveWorkoutSessions,
  getOrCreateWorkoutSession,
  getTrainingDays,
} from '@/db/queries/workout-sessions';
import { useTheme } from '@/hooks/use-theme';

type TrainingDays = Awaited<ReturnType<typeof getTrainingDays>>;
type ActiveSessions = Awaited<ReturnType<typeof getActiveWorkoutSessions>>;

export default function HomeScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const [days, setDays] = useState<TrainingDays>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessions>([]);
  const [loading, setLoading] = useState(true);
  const [startingDayId, setStartingDayId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [dayRows, sessionRows] = await Promise.all([
        getTrainingDays(database),
        getActiveWorkoutSessions(database),
      ]);
      setDays(dayRows);
      setActiveSessions(sessionRows);
    } catch {
      setError('No se pudieron cargar tus entrenamientos.');
    } finally {
      setLoading(false);
    }
  }, [database]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getTrainingDays(database),
        getActiveWorkoutSessions(database),
      ])
        .then(([dayRows, sessionRows]) => {
          if (!active) return;
          setDays(dayRows);
          setActiveSessions(sessionRows);
          setError(null);
        })
        .catch(() => {
          if (active) setError('No se pudieron cargar tus entrenamientos.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [database]),
  );

  async function openWorkout(dayId: number) {
    setStartingDayId(dayId);
    setError(null);
    try {
      const session = await getOrCreateWorkoutSession(database, dayId);
      router.push(`/routines/workout/${session.id}`);
    } catch {
      setError('No se pudo iniciar la sesión. Inténtalo de nuevo.');
    } finally {
      setStartingDayId(null);
    }
  }

  function openSession(sessionId: number) {
    router.push(`/routines/workout/${sessionId}`);
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <ThemedText style={styles.eyebrow} themeColor="textSecondary">
              GYM COMPANION
            </ThemedText>
            <ThemedText style={styles.title}>Hoy</ThemedText>
          </View>
          <View style={[styles.dateMark, { backgroundColor: theme.text }]}>
            <ThemedText
              style={[styles.dateMarkText, { color: theme.background }]}
            >
              {new Date().getDate()}
            </ThemedText>
          </View>
        </View>

        {error && days.length > 0 && (
          <View style={styles.errorRow}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
            >
              <ThemedText style={styles.actionText}>Reintentar</ThemedText>
            </Pressable>
          </View>
        )}

        {activeSessions.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>En curso</ThemedText>
            {activeSessions.map((session) => (
              <Pressable
                accessibilityRole="button"
                key={session.id}
                onPress={() => openSession(session.id)}
                style={({ pressed }) => [
                  styles.activeRow,
                  {
                    backgroundColor: theme.backgroundElement,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <View style={styles.activeIndicator} />
                <View style={styles.dayCopy}>
                  <ThemedText type="smallBold">{session.dayName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {session.routineName} · Iniciado{' '}
                    {session.startedAt.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </ThemedText>
                </View>
                <ThemedText style={styles.actionText}>Reanudar</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>Tus días</ThemedText>
            <Link href="/routines" asChild>
              <Pressable accessibilityRole="button">
                <ThemedText style={styles.actionText}>Rutinas</ThemedText>
              </Pressable>
            </Link>
          </View>

          {loading ? (
            <View style={styles.feedback}>
              <ActivityIndicator color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary">
                Cargando días...
              </ThemedText>
            </View>
          ) : error && days.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                No se pudieron cargar tus días
              </ThemedText>
              <ThemedText themeColor="textSecondary">{error}</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refresh()}
                style={styles.createLink}
              >
                <ThemedText style={styles.actionText}>Reintentar</ThemedText>
              </Pressable>
            </View>
          ) : days.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyMark}>01</ThemedText>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                Aún no hay días de entrenamiento
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Crea una rutina para empezar a registrar tus series.
              </ThemedText>
              <Link href="/routines/new" asChild>
                <Pressable style={styles.createLink}>
                  <ThemedText style={styles.actionText}>
                    Crear rutina
                  </ThemedText>
                  <SymbolView
                    name={{
                      ios: 'arrow.right',
                      android: 'arrow_right',
                      web: 'arrow_right',
                    }}
                    size={15}
                    tintColor={theme.text}
                  />
                </Pressable>
              </Link>
            </View>
          ) : (
            days.map((day, dayIndex) => {
              const activeSession = activeSessions.find(
                (session) => session.routineDayId === day.id,
              );
              const isStarting = startingDayId === day.id;

              return (
                <View
                  key={day.id}
                  style={[
                    styles.dayRow,
                    { borderColor: theme.backgroundSelected },
                  ]}
                >
                  <ThemedText
                    style={styles.dayNumber}
                    themeColor="textSecondary"
                  >
                    {String(dayIndex + 1).padStart(2, '0')}
                  </ThemedText>
                  <View style={styles.dayCopy}>
                    <ThemedText type="smallBold">{day.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {day.routineName}
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={startingDayId !== null}
                    onPress={() =>
                      activeSession
                        ? openSession(activeSession.id)
                        : void openWorkout(day.id)
                    }
                    style={({ pressed }) => [
                      styles.startButton,
                      {
                        backgroundColor: theme.text,
                        opacity: pressed || isStarting ? 0.72 : 1,
                      },
                    ]}
                  >
                    {isStarting ? (
                      <ActivityIndicator
                        color={theme.background}
                        size="small"
                      />
                    ) : (
                      <ThemedText
                        type="smallBold"
                        style={{ color: theme.background }}
                      >
                        {activeSession ? 'Seguir' : 'Empezar'}
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 36, gap: 24 },
  heading: {
    paddingTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingCopy: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  title: { fontSize: 38, fontWeight: '800', lineHeight: 44 },
  dateMark: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateMarkText: {
    fontSize: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  section: { gap: 10 },
  sectionHeading: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  activeRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 7,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34865b',
  },
  dayRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 13,
  },
  dayNumber: { width: 28, fontSize: 12, fontVariant: ['tabular-nums'] },
  dayCopy: { flex: 1, gap: 4 },
  startButton: {
    minWidth: 82,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedback: { paddingVertical: 34, alignItems: 'center', gap: 12 },
  errorRow: { gap: 6 },
  errorText: { color: '#c0392b', fontSize: 14 },
  actionText: { fontWeight: '700', textDecorationLine: 'underline' },
  emptyState: { paddingTop: 16, paddingBottom: 34, gap: 11 },
  emptyMark: { fontSize: 46, lineHeight: 52, fontWeight: '800', opacity: 0.16 },
  emptyTitle: { fontSize: 22, lineHeight: 28 },
  createLink: {
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
});
