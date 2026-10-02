/** Forma di dati scambiata tra le API di Pensione e il client (importi già numerici). */

export interface PensionSnapshotData {
  id: string;
  /** `YYYY-MM-DD`. */
  date: string;
  netContributions: number;
  value: number;
}

export interface PensionFundData {
  id: string;
  name: string;
  /** Data di prima adesione a una forma pensionistica, `YYYY-MM-DD`. */
  adhesionDate: string;
  /** Fotografie in ordine cronologico. */
  snapshots: PensionSnapshotData[];
}

/** Risposta di `GET /api/pension`. */
export interface PensionOverviewData {
  funds: PensionFundData[];
}
