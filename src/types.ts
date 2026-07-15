export interface MutationRecord {
  id?: string;
  timestamp: string; // ISO String
  remainingKwh: number; // Sisa kWh on the meter
  mutation: number; // Difference from previous reading
  type: 'consumption' | 'topup' | 'initial';
  notes: string;
}

export interface AppSettings {
  telegramToken: string;
  telegramChatId: string;
  lowThreshold: number; // Low threshold in kWh (e.g., 10 or 15)
  kwhTariff?: number; // Price per kWh (e.g., 14444.7)
  telegramEnabled: boolean;
  theme?: 'light' | 'dark';
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
