import { Link } from 'expo-router';
import { Host, Picker } from '@expo/ui';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  useThemePreference,
  type ThemePreference,
} from '@/components/theme-preference-provider';
import { useDatabase } from '@/db/provider';
import {
  getBackupData,
  parseBackupData,
  restoreBackup,
  type BackupData,
} from '@/db/queries/export';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<{
    data: BackupData;
    fileName: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportBackup() {
    setExporting(true);
    setMessage(null);
    setError(null);

    try {
      const backup = await getBackupData(database);
      const contents = JSON.stringify(backup, null, 2);
      const filename = `gym-companion-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([contents], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true });
        file.write(contents);
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('No está disponible la función de compartir.');
        }
        await Sharing.shareAsync(file.uri, {
          dialogTitle: 'Compartir copia de seguridad',
          mimeType: 'application/json',
          UTI: 'public.json',
        });
      }

      setMessage(`Archivo listo: ${filename}`);
    } catch {
      setError('No se pudo preparar la copia. Inténtalo de nuevo.');
    } finally {
      setExporting(false);
    }
  }

  async function chooseBackupFile() {
    setImporting(true);
    setPendingBackup(null);
    setMessage(null);
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset.name.toLocaleLowerCase().endsWith('.json')) {
        throw new Error('Selecciona un archivo con extensión .json.');
      }

      let contents: string;
      if (Platform.OS === 'web') {
        if (asset.file) {
          contents = await asset.file.text();
        } else {
          const response = await fetch(asset.uri);
          if (!response.ok) throw new Error('No se pudo leer el archivo.');
          contents = await response.text();
        }
      } else {
        contents = await new File(asset.uri).text();
      }

      const data = parseBackupData(contents);
      setPendingBackup({ data, fileName: asset.name });
      setMessage(
        `${data.routines.length} rutinas, ${data.exercises.length} ejercicios y ${data.workoutSessions.length} entrenamientos encontrados.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo leer la copia seleccionada.',
      );
    } finally {
      setImporting(false);
    }
  }

  async function importBackup() {
    if (!pendingBackup) return;

    setImporting(true);
    setMessage(null);
    setError(null);
    try {
      await restoreBackup(database, pendingBackup.data);
      setPendingBackup(null);
      setMessage('Copia importada correctamente.');
    } catch {
      setError(
        'No se pudo importar la copia. Los datos actuales se han conservado.',
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.heading}>
          <ThemedText style={styles.eyebrow} themeColor="textSecondary">
            PREFERENCIAS
          </ThemedText>
          <ThemedText style={styles.title}>Ajustes</ThemedText>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>Apariencia</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Se guarda en este dispositivo
            </ThemedText>
          </View>
          <Host matchContents={{ vertical: true }} style={styles.pickerHost}>
            <Picker
              selectedValue={preference}
              onValueChange={(value) => setPreference(value as ThemePreference)}
            >
              <Picker.Item label="Sistema" value="system" />
              <Picker.Item label="Claro" value="light" />
              <Picker.Item label="Oscuro" value="dark" />
            </Picker>
          </Host>
        </View>

        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <ThemedText style={styles.sectionTitle}>Biblioteca</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Ejercicios disponibles en este dispositivo
              </ThemedText>
            </View>
            <Link href="/exercises" asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.libraryLink,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.textSecondary,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
              >
                <View style={styles.libraryCopy}>
                  <ThemedText type="smallBold">Gestionar ejercicios</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Consultar y añadir al catálogo
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: 'dumbbell',
                    android: 'fitness_center',
                    web: 'fitness_center',
                  }}
                  size={20}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </Link>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>Tus datos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Copia de rutinas y entrenamientos
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Importar copia JSON"
            disabled={exporting || importing}
            onPress={() => void chooseBackupFile()}
            style={({ pressed }) => [
              styles.importButton,
              {
                opacity: pressed || exporting || importing ? 0.76 : 1,
              },
            ]}
          >
            {importing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <SymbolView
                name={{
                  ios: 'square.and.arrow.down',
                  android: 'file_download',
                  web: 'file_download',
                }}
                size={18}
                tintColor="#FFFFFF"
              />
            )}
            <ThemedText type="smallBold" style={styles.importLabel}>
              Importar copia JSON
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exportar copia JSON"
            disabled={exporting || importing}
            onPress={() => void exportBackup()}
            style={({ pressed }) => [
              styles.exportButton,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
                opacity: pressed || exporting || importing ? 0.68 : 1,
              },
            ]}
          >
            {exporting ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <SymbolView
                name={{
                  ios: 'square.and.arrow.up',
                  android: 'ios_share',
                  web: 'ios_share',
                }}
                size={18}
                tintColor={theme.text}
              />
            )}
            <ThemedText type="smallBold">Exportar copia JSON</ThemedText>
          </Pressable>
          {pendingBackup && (
            <View
              style={[
                styles.importConfirmation,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="smallBold" selectable>
                Restaurar {pendingBackup.fileName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Esta acción reemplazará las rutinas, ejercicios y entrenamientos
                de este dispositivo. No se puede deshacer.
              </ThemedText>
              <View style={styles.confirmationActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={importing}
                  onPress={() => setPendingBackup(null)}
                  style={styles.cancelButton}
                >
                  <ThemedText type="smallBold">Cancelar</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={importing}
                  onPress={() => void importBackup()}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    {
                      backgroundColor: theme.text,
                      opacity: pressed || importing ? 0.65 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={{ color: theme.background }}
                  >
                    Importar copia
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}
          {message && (
            <ThemedText
              accessibilityLiveRegion="polite"
              themeColor="textSecondary"
            >
              {message}
            </ThemedText>
          )}
          {error && (
            <ThemedText accessibilityRole="alert" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 40,
    gap: 30,
  },
  heading: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 36, fontWeight: '800', lineHeight: 42 },
  section: { gap: 13 },
  sectionHeading: { gap: 4 },
  sectionTitle: { fontSize: 19, fontWeight: '800' },
  libraryLink: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 7,
  },
  libraryCopy: { gap: 2 },
  pickerHost: { width: '100%' },
  exportButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 7,
  },
  importButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: '#208AEF',
  },
  importLabel: { color: '#FFFFFF' },
  importConfirmation: { padding: 14, borderRadius: 7, gap: 12 },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  confirmButton: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  errorText: { color: '#c0392b' },
});
