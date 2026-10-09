import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/db/provider';
import { getRoutineSummaries } from '@/db/queries/routines';
import { useTheme } from '@/hooks/use-theme';

export default function RoutinesScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const [routines, setRoutines] = useState<
    Awaited<ReturnType<typeof getRoutineSummaries>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutines = useCallback(
    () => getRoutineSummaries(database),
    [database],
  );

  const refreshRoutines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutines(await fetchRoutines());
    } catch {
      setError('No se pudieron cargar tus rutinas.');
    } finally {
      setLoading(false);
    }
  }, [fetchRoutines]);

  useEffect(() => {
    let active = true;
    fetchRoutines()
      .then((results) => {
        if (!active) return;
        setRoutines(results);
        setError(null);
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar tus rutinas.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchRoutines]);

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        data={routines}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <>
            <View style={styles.heading}>
              <View style={styles.headingCopy}>
                <ThemedText style={styles.eyebrow} themeColor="textSecondary">
                  PLANIFICACIÓN
                </ThemedText>
                <ThemedText style={styles.title}>Rutinas</ThemedText>
              </View>
              <Link href="/routines/new" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.newButton,
                    {
                      backgroundColor: theme.text,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: 'plus',
                      android: 'add_circle',
                      web: 'add_circle',
                    }}
                    size={17}
                    tintColor={theme.background}
                  />
                  <ThemedText
                    style={{ color: theme.background }}
                    type="smallBold"
                  >
                    Nueva
                  </ThemedText>
                </Pressable>
              </Link>
            </View>
            {error && routines.length > 0 && (
              <View style={styles.inlineError}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
                <Pressable onPress={() => void refreshRoutines()}>
                  <ThemedText style={styles.actionText}>Reintentar</ThemedText>
                </Pressable>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.feedback}>
              <ActivityIndicator color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary">
                Cargando rutinas...
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                No se pudo cargar
              </ThemedText>
              <ThemedText themeColor="textSecondary">{error}</ThemedText>
              <Pressable onPress={() => void refreshRoutines()}>
                <ThemedText style={styles.actionText}>Reintentar</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyMark}>01</ThemedText>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                Empieza por tu plan
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Crea una rutina y organiza tus días de entrenamiento.
              </ThemedText>
              <Link href="/routines/new" asChild>
                <Pressable style={styles.textButton}>
                  <ThemedText style={styles.actionText}>
                    Crear primera rutina
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
          )
        }
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/routines/${item.id}`)}
            style={({ pressed }) => [
              styles.routineRow,
              {
                borderColor: theme.backgroundSelected,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <View style={styles.rowNumber}>
              <ThemedText style={styles.numberText} themeColor="textSecondary">
                {String(index + 1).padStart(2, '0')}
              </ThemedText>
            </View>
            <View style={styles.routineCopy}>
              <ThemedText type="smallBold" style={styles.routineName}>
                {item.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.dayCount} {item.dayCount === 1 ? 'día' : 'días'}
                {item.description ? `  ·  ${item.description}` : ''}
              </ThemedText>
            </View>
            <SymbolView
              name={{
                ios: 'chevron.right',
                android: 'chevron_right',
                web: 'chevron_right',
              }}
              size={15}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        )}
        refreshing={loading && routines.length > 0}
        onRefresh={() => void refreshRoutines()}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 32, flexGrow: 1 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 28,
  },
  headingCopy: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  title: { fontSize: 36, fontWeight: '800', lineHeight: 42 },
  newButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  feedback: { paddingVertical: 42, alignItems: 'center', gap: 12 },
  inlineError: { paddingBottom: 14, gap: 6 },
  errorText: { color: '#c0392b', fontSize: 14 },
  emptyState: { paddingTop: 34, paddingBottom: 50, gap: 12 },
  emptyMark: { fontSize: 52, lineHeight: 58, fontWeight: '800', opacity: 0.16 },
  emptyTitle: { fontSize: 25, lineHeight: 31 },
  textButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingTop: 10,
  },
  actionText: { fontWeight: '700', textDecorationLine: 'underline' },
  routineRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 15,
  },
  rowNumber: { width: 29 },
  numberText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  routineCopy: { flex: 1, gap: 4 },
  routineName: { fontSize: 17 },
});
