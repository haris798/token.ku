import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatabase } from '../lib/database/rxdb';
import { MutationRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Hook untuk mengambil semua mutasi (terhubung ke RxDB)
export function useTokenMutations() {
  return useQuery({
    queryKey: ['mutations'],
    queryFn: async () => {
      const db = await getDatabase();
      const docs = await db.mutations.find().sort({ timestamp: 'asc' }).exec();
      return docs.map(doc => doc.toJSON());
    },
    // Karena RxDB punya observable, kita bisa set ini agar react-query merefresh
    // setiap kali ada pembaruan lokal (optional, bisa di-handle terpisah dengan subscription RxDB)
  });
}

// Hook untuk menambah mutasi baru
export function useAddMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newRecord: Omit<MutationRecord, 'id'>) => {
      const db = await getDatabase();
      
      const recordToSave: MutationRecord = {
        ...newRecord,
        id: uuidv4(), // Generate ID unik
      };

      await db.mutations.insert(recordToSave);
      return recordToSave;
    },
    onSuccess: () => {
      // Refresh cache setelah mutasi sukses
      queryClient.invalidateQueries({ queryKey: ['mutations'] });
    },
  });
}

// Hook untuk menghapus mutasi
export function useDeleteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const db = await getDatabase();
      const query = db.mutations.find({
        selector: { id }
      });
      await query.remove();
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutations'] });
    },
  });
}
