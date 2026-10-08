# Gym Companion

Aplicación móvil para crear rutinas, registrar entrenamientos y seguir la progresión de cargas. Está construida con Expo, React Native y TypeScript, con soporte offline mediante SQLite.

## Requisitos

- Node.js 22.13 o superior
- npm

## Desarrollo

```bash
npm install
npm start
```

Usa la salida de Expo para abrir la app en un dispositivo, emulador o navegador.

Las rutas están en `src/app/` y usan [Expo Router](https://docs.expo.dev/router/introduction).

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm run format:check
npx expo-doctor
```

## Stack

- Expo SDK 57 y Expo Router
- TypeScript y NativeWind 4
- SQLite con Drizzle ORM
- ESLint y Prettier

La configuración de SQLite y las migraciones se implementan en la Fase 1.

## Documentación

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Recursos

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
