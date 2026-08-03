import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `CARNET_BASE` permet de servir l'application depuis un sous-chemin
 * (GitHub Pages : `CARNET_BASE=/carnet/ npm run build`). Tout le reste du code
 * passe par `import.meta.env.BASE_URL`, jamais par un chemin absolu en dur.
 */
const base = process.env.CARNET_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      // Le service worker attend : c'est l'application qui décide du moment
      // d'appliquer la mise à jour, jamais en pleine session de révision.
      registerType: 'prompt',
      injectRegister: null,

      // Ni `includeAssets`, ni l'ajout automatique des icônes du manifeste :
      // `globPatterns` balaie déjà `dist/`, où `public/` a été recopié. Les
      // trois mécanismes ensemble inscrivaient chaque icône jusqu'à trois fois
      // dans le manifeste de précache.
      includeManifestIcons: false,

      manifest: {
        name: 'Go to Bristol',
        short_name: 'Bristol',
        description: 'L’anglais qu’il faut pour être chez soi à Bristol.',
        lang: 'fr',
        dir: 'ltr',
        // Relatifs au manifeste : fonctionne quel que soit `base`.
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        // La couleur du papier aquarelle : `--paper` dans `src/ui/tokens.css`.
        background_color: '#FBF8F1',
        theme_color: '#FBF8F1',
        categories: ['education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // App shell précaché (cache-first). Les packs en sont volontairement
        // exclus : ils sont plus gros, ils changent seuls, et une mise à jour
        // de contenu ne doit pas invalider tout le cache de l'application.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Le premier service worker prend la main tout de suite, sinon la
        // toute première visite n'est pas contrôlée et le pack n'entre jamais
        // dans le cache d'exécution. N'affecte pas les mises à jour : elles
        // continuent d'attendre le feu vert de l'utilisatrice.
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/packs/'),
            // `StaleWhileRevalidate` rendait toujours la copie en cache et
            // rafraîchissait pour la fois d'après. C'est le bon compromis pour
            // une image ; c'en est un mauvais pour le contenu enseigné : cent
            // unités publiées un lundi n'apparaissaient qu'au deuxième
            // lancement, et sur iOS une PWA revenue au premier plan ne relance
            // rien — il n'y avait donc pas de deuxième lancement.
            //
            // `NetworkFirst` avec trois secondes de patience inverse la règle :
            // en ligne on voit le contenu du jour, hors ligne on retombe sur le
            // cache sans attendre. Un pack inchangé revient en 304 sans corps,
            // donc le coût réel est un aller-retour, pas 700 ko.
            handler: 'NetworkFirst',
            options: {
              cacheName: 'carnet-packs',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
