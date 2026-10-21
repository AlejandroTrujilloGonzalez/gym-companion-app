import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/db/provider';
import { createExercise, getExercises } from '@/db/queries/exercises';
import { useTheme } from '@/hooks/use-theme';

type CatalogRows = Awaited<ReturnType<typeof getExercises>>;

export default function ExercisesScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const [catalog, setCatalog] = useState<CatalogRows>([]);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCatalog = useCallback(
    async (isActive: () => boolean = () => true) => {
      setLoading(true);
      setLoadError(null);
      try {
        const rows = await getExercises(database);
        if (isActive()) setCatalog(rows);
      } catch {
        if (isActive()) {
          setLoadError('No se pudo cargar el catálogo. Inténtalo de nuevo.');
        }
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [database],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadCatalog(() => active);
      return () => {
        active = false;
      };
    }, [loadCatalog]),
  );

  const filteredExercises = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return catalog.filter((exercise) =>
      `${exercise.name} ${exercise.muscleGroup ?? ''}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [catalog, search]);

  async function saveExercise() {
    const normalizedName = name.trim();
    const normalizedGroup = muscleGroup.trim();
    if (!normalizedName) {
      setFormError('Escribe el nombre del ejercicio.');
      return;
    }
    if (
      catalog.some(
        (exercise) =>
          exercise.name.toLocaleLowerCase() ===
          normalizedName.toLocaleLowerCase(),
      )
    ) {
      setFormError('Ya existe un ejercicio con ese nombre.');
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await createExercise(database, {
        name: normalizedName,
        muscleGroup: normalizedGroup || undefined,
      });
      await loadCatalog();
      setName('');
      setMuscleGroup('');
      setNotice(`“${normalizedName}” se añadió al catálogo.`);
    } catch {
      setFormError('No se pudo guardar el ejercicio. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  if (loading && catalog.length === 0 && !loadError) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary">
          Cargando ejercicios...
        </ThemedText>
      </ThemedView>
    );
  }

  if (loadError && catalog.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText accessibilityRole="alert" style={styles.error}>
          {loadError}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadCatalog()}
          style={styles.textButton}
        >
          <ThemedText style={styles.actionText}>Reintentar</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          data={filteredExercises}
          keyExtractor={(exercise) => String(exercise.id)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <ThemedText style={styles.empty} themeColor="textSecondary">
              {search.trim()
                ? 'No hay ejercicios que coincidan con la búsqueda.'
                : 'Aún no hay ejercicios en el catálogo.'}
            </ThemedText>
          }
          ListHeaderComponent={
            <View style={styles.headerContent}>
              <View style={styles.heading}>
                <ThemedText style={styles.eyebrow} themeColor="textSecondary">
                  TU BIBLIOTECA
                </ThemedText>
                <ThemedText style={styles.title}>Ejercicios</ThemedText>
                <ThemedText themeColor="textSecondary">
                  {catalog.length}{' '}
                  {catalog.length === 1
                    ? 'ejercicio disponible'
                    : 'ejercicios disponibles'}
                </ThemedText>
              </View>

              <View style={styles.formSection}>
                <ThemedText style={styles.sectionTitle}>
                  Añadir ejercicio
                </ThemedText>
                <TextInput
                  accessibilityLabel="Nombre del ejercicio"
                  maxLength={80}
                  onChangeText={(value) => {
                    setName(value);
                    setFormError(null);
                    setNotice(null);
                  }}
                  onSubmitEditing={() => void saveExercise()}
                  placeholder="Ej. Press de pecho en máquina"
                  placeholderTextColor={theme.textSecondary}
                  returnKeyType="done"
                  style={inputStyle}
                  value={name}
                />
                <TextInput
                  accessibilityLabel="Grupo muscular (opcional)"
                  maxLength={50}
                  onChangeText={setMuscleGroup}
                  onSubmitEditing={() => void saveExercise()}
                  placeholder="Grupo muscular (opcional)"
                  placeholderTextColor={theme.textSecondary}
                  returnKeyType="done"
                  style={inputStyle}
                  value={muscleGroup}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || !name.trim()}
                  onPress={() => void saveExercise()}
                  style={({ pressed }) => [
                    styles.saveButton,
                    {
                      backgroundColor: theme.text,
                      opacity: saving || !name.trim() || pressed ? 0.55 : 1,
                    },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.background} />
                  ) : (
                    <ThemedText
                      type="smallBold"
                      style={{ color: theme.background }}
                    >
                      Guardar en el catálogo
                    </ThemedText>
                  )}
                </Pressable>
                {formError && (
                  <ThemedText accessibilityRole="alert" style={styles.error}>
                    {formError}
                  </ThemedText>
                )}
                {notice && (
                  <ThemedText
                    accessibilityLiveRegion="polite"
                    themeColor="textSecondary"
                  >
                    {notice}
                  </ThemedText>
                )}
              </View>

              <View style={styles.catalogHeading}>
                <ThemedText style={styles.sectionTitle}>Catálogo</ThemedText>
                {loading && (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                )}
              </View>
              <TextInput
                accessibilityLabel="Buscar ejercicios"
                onChangeText={setSearch}
                placeholder="Buscar por nombre o grupo muscular"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="search"
                style={inputStyle}
                value={search}
              />
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.exerciseRow}>
              <View style={styles.exerciseCopy}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.muscleGroup || 'Sin grupo muscular'}
                </ThemedText>
              </View>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 36,
  },
  headerContent: { gap: 24, paddingBottom: 12 },
  heading: { gap: 4 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  formSection: {
    gap: 10,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#88888855',
  },
  sectionTitle: { fontSize: 19, lineHeight: 25, fontWeight: '800' },
  input: {
    minHeight: 46,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  saveButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 14,
  },
  catalogHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseRow: {
    minHeight: 62,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#88888855',
  },
  exerciseCopy: { gap: 2 },
  empty: { paddingVertical: 24, textAlign: 'center' },
  error: { color: '#c0392b', fontSize: 14 },
  textButton: { padding: 8 },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
