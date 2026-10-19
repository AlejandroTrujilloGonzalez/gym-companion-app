import { Host, Picker } from '@expo/ui';
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
import { getBackupData } from '@/db/queries/export';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const database = useDatabase();
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  const [exporting, setExporting] = useState(false);
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

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>Tus datos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Copia de rutinas y entrenamientos
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            onPress={() => void exportBackup()}
            style={({ pressed }) => [
              styles.exportButton,
              {
                backgroundColor: theme.text,
                opacity: pressed || exporting ? 0.72 : 1,
              },
            ]}
          >
            {exporting ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <SymbolView
                name={{
                  ios: 'square.and.arrow.up',
                  android: 'ios_share',
                  web: 'ios_share',
                }}
                size={18}
                tintColor={theme.background}
              />
            )}
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Exportar copia JSON
            </ThemedText>
          </Pressable>
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
  pickerHost: { width: '100%' },
  exportButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 7,
  },
  errorText: { color: '#c0392b' },
});
