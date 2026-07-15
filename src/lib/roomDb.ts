import { Preferences } from '@capacitor/preferences';
import { MutationRecord, AppSettings } from '../types';

// --- Room Entities (Represented as TypeScript interfaces) ---
export interface MutationEntity extends MutationRecord {}
export interface SettingsEntity extends AppSettings {}

// --- Room DAOs (Data Access Objects) ---
export class MutationDao {
  private static readonly TABLE_KEY = 'room_mutation_table';

  /**
   * Mengambil semua data mutasi (equivalent to @Query("SELECT * FROM mutation_table"))
   */
  async getAll(): Promise<MutationEntity[]> {
    const { value } = await Preferences.get({ key: MutationDao.TABLE_KEY });
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('Failed to parse Room MutationEntity list:', e);
      return [];
    }
  }

  /**
   * Menyisipkan atau mengupdate data mutasi (equivalent to @Insert(onConflict = OnConflictStrategy.REPLACE))
   */
  async insert(entity: MutationEntity): Promise<void> {
    const list = await this.getAll();
    const existingIndex = list.findIndex(m => m.id === entity.id);
    if (existingIndex > -1) {
      list[existingIndex] = entity;
    } else {
      list.push(entity);
    }
    await Preferences.set({
      key: MutationDao.TABLE_KEY,
      value: JSON.stringify(list)
    });
  }

  /**
   * Menyisipkan banyak data sekaligus (equivalent to @Insert(onConflict = OnConflictStrategy.REPLACE))
   */
  async insertAll(entities: MutationEntity[]): Promise<void> {
    const list = await this.getAll();
    entities.forEach(entity => {
      const existingIndex = list.findIndex(m => m.id === entity.id);
      if (existingIndex > -1) {
        list[existingIndex] = entity;
      } else {
        list.push(entity);
      }
    });
    await Preferences.set({
      key: MutationDao.TABLE_KEY,
      value: JSON.stringify(list)
    });
  }

  /**
   * Menghapus data mutasi berdasarkan ID (equivalent to @Delete)
   */
  async delete(id: string): Promise<void> {
    let list = await this.getAll();
    list = list.filter(m => m.id !== id);
    await Preferences.set({
      key: MutationDao.TABLE_KEY,
      value: JSON.stringify(list)
    });
  }

  /**
   * Menghapus semua data mutasi
   */
  async deleteAll(): Promise<void> {
    await Preferences.remove({ key: MutationDao.TABLE_KEY });
  }

  /**
   * Mengambil data berdasarkan ID
   */
  async getById(id: string): Promise<MutationEntity | null> {
    const list = await this.getAll();
    return list.find(m => m.id === id) || null;
  }
}

export class SettingsDao {
  private static readonly TABLE_KEY = 'room_settings_table';

  /**
   * Mengambil data pengaturan aplikasi
   */
  async getSettings(): Promise<SettingsEntity | null> {
    const { value } = await Preferences.get({ key: SettingsDao.TABLE_KEY });
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('Failed to parse Room SettingsEntity:', e);
      return null;
    }
  }

  /**
   * Menyimpan atau mengupdate pengaturan aplikasi
   */
  async updateSettings(settings: SettingsEntity): Promise<void> {
    await Preferences.set({
      key: SettingsDao.TABLE_KEY,
      value: JSON.stringify(settings)
    });
  }
}

// --- AppRoomDatabase (Koordinasi Database utama mirip Android RoomDatabase) ---
export class AppRoomDatabase {
  private static instance: AppRoomDatabase | null = null;
  private _mutationDao: MutationDao;
  private _settingsDao: SettingsDao;

  private constructor() {
    this._mutationDao = new MutationDao();
    this._settingsDao = new SettingsDao();
  }

  public static getInstance(): AppRoomDatabase {
    if (!AppRoomDatabase.instance) {
      AppRoomDatabase.instance = new AppRoomDatabase();
    }
    return AppRoomDatabase.instance;
  }

  public mutationDao(): MutationDao {
    return this._mutationDao;
  }

  public settingsDao(): SettingsDao {
    return this._settingsDao;
  }
}

export const getRoomDatabase = (): AppRoomDatabase => {
  return AppRoomDatabase.getInstance();
};
