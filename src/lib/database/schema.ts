import { RxJsonSchema } from 'rxdb';
import { MutationRecord, AppSettings } from '../../types';

export const mutationSchema: RxJsonSchema<MutationRecord> = {
  title: 'mutations schema',
  version: 0,
  description: 'Mencatat mutasi (konsumsi/topup) kWh',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100 // RxDB requires maxLength for strings used in indexes/primary keys
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    },
    remainingKwh: {
      type: 'number'
    },
    mutation: {
      type: 'number'
    },
    type: {
      type: 'string',
      enum: ['consumption', 'topup', 'initial']
    },
    notes: {
      type: 'string'
    },
    synced: {
      type: 'boolean'
    }
  },
  required: ['id', 'timestamp', 'remainingKwh', 'mutation', 'type']
};
