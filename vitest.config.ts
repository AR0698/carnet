import { defineConfig } from 'vitest/config';

/**
 * Configuration distincte de `vite.config.ts` : les tests n'ont que faire du
 * plugin PWA, qui générerait un service worker à chaque exécution.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // `fake-indexeddb` doit être en place avant que `storage/db.ts` ne
    // construise son instance Dexie, ce qu'il fait dès son import.
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
