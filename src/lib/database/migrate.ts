import { getDatabase } from './rxdb';
import { v4 as uuidv4 } from 'uuid';
import { MutationRecord } from '../../types';

const loadLocalMutations = (): MutationRecord[] => {
  try {
    const saved = localStorage.getItem('tokenpro_mutations');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const migrateFromLocalStorage = async () => {
  try {
    const db = await getDatabase();
    
    // Cek apakah RxDB sudah ada datanya
    const existingCount = await db.mutations.count().exec();
    
    // Jika masih kosong, coba migrasi dari localStorage
    if (existingCount === 0) {
      const localMutations = loadLocalMutations();
      
      if (localMutations.length > 0) {
        console.log('Memulai migrasi dari LocalStorage ke RxDB...', localMutations.length, 'data');
        
        const toInsert = localMutations.map(m => ({
          ...m,
          id: m.id || uuidv4(), // Pastikan semua punya ID valid
        }));
        
        await db.mutations.bulkInsert(toInsert);
        console.log('Migrasi selesai!');
        
        // Tandai bahwa migrasi selesai agar tidak diulang (meskipun kita juga mengecek existingCount)
        localStorage.setItem('rxdb_migrated', 'true');
      }
    }
  } catch (error) {
    console.error('Gagal melakukan migrasi data lokal:', error);
  }
};
