import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { mutationSchema } from './schema';
import { MutationRecord } from '../../types';

// Add plugins
addRxPlugin(RxDBQueryBuilderPlugin);
// If Supabase replication is needed:
// import { SupabaseReplication } from 'rxdb/plugins/replication-supabase';
// addRxPlugin(SupabaseReplication);

export type MyDatabaseCollections = {
  mutations: RxCollection<MutationRecord>;
};

export type MyDatabase = RxDatabase<MyDatabaseCollections>;

let dbPromise: Promise<MyDatabase> | null = null;

export const getDatabase = async () => {
  if (!dbPromise) {
    dbPromise = createRxDatabase<MyDatabaseCollections>({
      name: 'tokenpro_rxdb',
      storage: getRxStorageDexie(),
      ignoreDuplicate: true
    }).then(async (db) => {
      await db.addCollections({
        mutations: {
          schema: mutationSchema
        }
      });
      return db;
    });
  }
  return dbPromise;
};

/**
 * Setup replication with Supabase (placeholder for future implementation if enabled)
 */
export const setupSupabaseReplication = async (db: MyDatabase, supabaseUrl: string, supabaseAnonKey: string) => {
  // We can implement Supabase replication here using rxdb/plugins/replication-supabase
  // or a custom replication approach.
  console.log('Supabase replication is ready to be configured for', supabaseUrl);
};
