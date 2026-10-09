# 🏋️ GymCompanion — Plan de Implementación

App móvil (iOS/Android) para gestionar rutinas de entrenamiento, registrar marcas de peso y recibir sugerencias de progresión.

## 🧱 Stack Tecnológica

| Capa          | Tecnología                                   | Motivo                                   |
| ------------- | -------------------------------------------- | ---------------------------------------- |
| Framework     | **Expo (SDK 57)**                            | Multiplataforma, builds en la nube (EAS) |
| Lenguaje      | **TypeScript**                               | Tipado, calidad para portfolio           |
| Navegación    | **Expo Router**                              | File-based routing, tabs nativas         |
| Base de datos | **SQLite** (`expo-sqlite`) + **Drizzle ORM** | Offline-first, queries tipadas           |
| Estilos       | **Nativewind v4**                            | Tailwind en React Native, rápido         |
| Estado        | **Zustand**                                  | Ligero, sin boilerplate                  |
| Formularios   | **react-hook-form + zod**                    | Validación robusta                       |
| Iconos        | **lucide-react-native**                      | Consistentes y modernos                  |

---

## 📂 Estructura del Proyecto

```
gym-companion/
├── app/                          # Rutas (Expo Router)
│   ├── _layout.tsx               # Root layout + DB provider
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── index.tsx             # Hoy / Entrenamiento del día
│   │   ├── routines.tsx          # Lista de rutinas
│   │   └── progress.tsx          # Progreso y gráficas
│   ├── routine/
│   │   ├── [id].tsx              # Detalle/edición de rutina
│   │   └── new.tsx               # Crear rutina
│   ├── exercise/
│   │   └── [id].tsx              # Historial de marcas de un ejercicio
│   └── workout/
│       └── [routineId].tsx       # Sesión activa (registrar series)
├── src/
│   ├── db/
│   │   ├── schema.ts             # Esquema Drizzle
│   │   ├── client.ts             # Conexión SQLite
│   │   ├── migrations/           # Migraciones generadas
│   │   └── queries/              # Funciones de acceso a datos
│   ├── components/               # UI reutilizable
│   ├── store/                    # Zustand stores
│   ├── lib/
│   │   └── suggestions.ts        # Lógica de sugerencias
│   └── types/
├── assets/
├── tailwind.config.js
├── metro.config.js
├── app.json
└── tsconfig.json
```

---

## 🗄️ Modelo de Datos (SQLite)

```
routines
  id, name, description, created_at

routine_days
  id, routine_id (FK), name (ej: "Push"), day_order

exercises
  id, name, muscle_group, notes

routine_day_exercises          # Ejercicios asignados a un día
  id, routine_day_id (FK), exercise_id (FK),
  target_sets, target_reps, order

workout_sessions               # Un entrenamiento realizado
  id, routine_day_id (FK), started_at, finished_at

set_logs                       # Cada serie registrada
  id, session_id (FK), exercise_id (FK),
  set_number, weight, reps, rpe, created_at
```

**Relaciones clave:** una rutina → varios días → varios ejercicios; cada sesión genera `set_logs` que alimentan el progreso y las sugerencias.

---

## 🗓️ Fases de Implementación

### Fase 0 — Setup (0.5 día)

- [x] Proyecto Expo con TypeScript y Expo Router existente
- [x] Instalar y configurar **Nativewind v4** (`tailwind.config.js`, `metro.config.js`, `global.css`)
- [x] Instalar `expo-sqlite`, `drizzle-orm`, `drizzle-kit`
- [x] Expo Router con tabs
- [x] ESLint + Prettier
- [x] Repo en GitHub + README inicial

### Fase 1 — Capa de datos (1 día)

- [x] Definir `schema.ts` con Drizzle
- [x] Configurar cliente SQLite + migraciones (`drizzle-kit generate`)
- [x] Hook `useMigrations` en el root layout
- [x] Funciones CRUD en `queries/` (rutinas, días, ejercicios)
- [x] Seed con ejercicios comunes (sentadilla, press banca, peso muerto…)

### Fase 2 — Gestión de rutinas (1.5 días)

- [ ] Pantalla lista de rutinas
- [ ] Crear/editar rutina con días
- [ ] Añadir ejercicios a cada día (series/reps objetivo)
- [ ] Reordenar y eliminar

### Fase 3 — Registrar entrenamiento y marcas (2 días)

- [ ] Pantalla "Hoy": selecciona el día a entrenar
- [ ] Sesión activa: registrar peso/reps/RPE por serie
- [ ] Guardar `set_logs` en SQLite
- [ ] Autocompletar con la marca de la última sesión
- [ ] Finalizar sesión

### Fase 4 — Progreso (1.5 días)

- [ ] Historial por ejercicio
- [ ] Gráfica de evolución de peso (`react-native-gifted-charts`)
- [ ] Récords personales (PRs)
- [ ] Volumen total por sesión

### Fase 5 — Sugerencias (1 día)

- [ ] `suggestions.ts` con reglas de **progressive overload**:
  - Si completaste todas las series/reps objetivo → sugiere +2.5 kg
  - Si fallaste reps 2 sesiones seguidas → sugiere deload (-10%)
  - Alertar si un grupo muscular no se entrena hace >X días
- [ ] Mostrar sugerencia al iniciar cada ejercicio
- [ ] _(Opcional)_ Sugerencias con IA vía API

### Fase 6 — Pulido y build (1 día)

- [ ] Tema claro/oscuro con Nativewind
- [ ] Estados vacíos y animaciones (`react-native-reanimated`)
- [ ] Iconos y splash screen
- [ ] **EAS Build** → generar APK: `eas build -p android --profile preview`
- [ ] README con capturas/GIF, stack y features para el portfolio

---

## 🎯 Lógica de Sugerencias (regla base)

```ts
// src/lib/suggestions.ts
function suggestNextWeight(
  last: SetLog[],
  target: { sets: number; reps: number },
) {
  const allHit =
    last.length >= target.sets && last.every((s) => s.reps >= target.reps);
  const lastWeight = last.at(-1)?.weight ?? 0;

  if (allHit)
    return { weight: lastWeight + 2.5, reason: 'Completaste el objetivo 💪' };
  const failedTwice = /* comprobar 2 sesiones fallidas */ false;
  if (failedTwice)
    return { weight: lastWeight * 0.9, reason: 'Deload para recuperar' };
  return { weight: lastWeight, reason: 'Mantén y consolida la técnica' };
}
```

---

## 🚀 Comandos Clave

```bash
# Desarrollo
npx expo start

# Migraciones Drizzle
npx drizzle-kit generate

# Build Android (APK) sin Mac
eas build -p android --profile preview

# Build iOS
eas build -p ios --profile preview
```

---

## ✨ Extras para destacar en el portfolio

- 📴 **Offline-first** (todo funciona sin conexión)
- 🌙 Modo oscuro
- 📊 Gráficas de progreso
- 🤖 Sugerencias inteligentes de progresión
- 🧪 Tests básicos con Jest/React Native Testing Library
- 📸 README con GIF de la app en acción

**Estimación total:** ~8–9 días de trabajo.
