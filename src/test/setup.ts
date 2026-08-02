/**
 * IndexedDB en mémoire, installé globalement avant tout import de `storage/`.
 *
 * `storage/db.ts` instancie Dexie au moment de son import : sans cette ligne
 * chargée en premier, la construction échouerait faute d'`indexedDB` global.
 */
import 'fake-indexeddb/auto';
