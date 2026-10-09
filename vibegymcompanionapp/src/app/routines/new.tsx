import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/db/provider';
import { createRoutineWithDays } from '@/db/queries/routines';
import { useTheme } from '@/hooks/use-theme';

export default function NewRoutineScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState(['Día 1']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRoutine() {
    const normalizedName = name.trim();
    const normalizedDays = days.map((day) => day.trim());

    if (!normalizedName) {
      setError('Escribe un nombre para la rutina.');
      return;
    }
    if (normalizedDays.some((day) => !day)) {
      setError('Cada día necesita un nombre.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const routine = await createRoutineWithDays(
        database,
        { name: normalizedName, description: description.trim() || undefined },
        normalizedDays,
      );
      router.replace(`/routines/${routine.id}`);
    } catch {
      setError(
        'No se pudo guardar. Tus datos siguen aquí; inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText style={styles.eyebrow} themeColor="textSecondary">
            NUEVO PLAN
          </ThemedText>
          <ThemedText style={styles.title}>Define tu rutina</ThemedText>
          <ThemedText style={styles.description} themeColor="textSecondary">
            Ponle un nombre y organiza tus días. Podrás añadir ejercicios en el
            siguiente paso.
          </ThemedText>

          <View style={styles.fieldGroup}>
            <ThemedText type="smallBold">Nombre</ThemedText>
            <TextInput
              accessibilityLabel="Nombre de la rutina"
              autoFocus
              maxLength={60}
              onChangeText={setName}
              placeholder="Ej. Fuerza 3 días"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              value={name}
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="smallBold">Descripción</ThemedText>
            <TextInput
              accessibilityLabel="Descripción de la rutina"
              maxLength={180}
              multiline
              onChangeText={setDescription}
              placeholder="Objetivo o notas (opcional)"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                styles.multiline,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              value={description}
            />
          </View>

          <View style={styles.sectionHeading}>
            <View style={styles.sectionCopy}>
              <ThemedText type="smallBold">Días de entrenamiento</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                En el orden en que los realizarás
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setDays((current) => [...current, `Día ${current.length + 1}`])
              }
              style={styles.addDayButton}
            >
              <ThemedText style={styles.addDayText}>+ Añadir</ThemedText>
            </Pressable>
          </View>

          <View style={styles.dayList}>
            {days.map((day, index) => (
              <View key={index} style={styles.dayRow}>
                <ThemedText style={styles.dayIndex} themeColor="textSecondary">
                  {String(index + 1).padStart(2, '0')}
                </ThemedText>
                <TextInput
                  accessibilityLabel={`Nombre del día ${index + 1}`}
                  maxLength={40}
                  onChangeText={(value) =>
                    setDays((current) =>
                      current.map((currentDay, currentIndex) =>
                        currentIndex === index ? value : currentDay,
                      ),
                    )
                  }
                  placeholder="Nombre del día"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.dayInput, { color: theme.text }]}
                  value={day}
                />
                {days.length > 1 && (
                  <Pressable
                    accessibilityLabel={`Eliminar día ${index + 1}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() =>
                      setDays((current) =>
                        current.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                    style={styles.removeDay}
                  >
                    <ThemedText themeColor="textSecondary">×</ThemedText>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundSelected,
            },
          ]}
        >
          {error && (
            <ThemedText accessibilityRole="alert" style={styles.error}>
              {error}
            </ThemedText>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void saveRoutine()}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: '#208AEF',
                opacity: saving || pressed ? 0.7 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                Crear rutina
              </ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 15,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  description: { fontSize: 15, lineHeight: 22, maxWidth: 440 },
  fieldGroup: { gap: 8, paddingTop: 8 },
  input: {
    minHeight: 48,
    borderRadius: 7,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 86, textAlignVertical: 'top' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  sectionCopy: { gap: 3 },
  addDayButton: { padding: 8 },
  addDayText: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  dayList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#88888855',
  },
  dayRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#88888855',
  },
  dayIndex: { width: 25, fontSize: 12, fontVariant: ['tabular-nums'] },
  dayInput: { flex: 1, minHeight: 48, fontSize: 16 },
  removeDay: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#c0392b', fontSize: 14 },
  saveButton: {
    minHeight: 50,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
