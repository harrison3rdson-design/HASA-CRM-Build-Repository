export type RecoveryVerification = {
  valid: boolean;
  format: string;
  formatVersion: number;
  createdAt: string;
  sourceProjectRef: string;
  protectedDataSha256: string;
  summary: {
    tableCount: number;
    rowCount: number;
    bucketCount: number;
    objectCount: number;
    objectBytes: number;
  };
};
export function verifyRecoveryBackup(backup: unknown): RecoveryVerification;
export function verifyRecoveryBackupFile(
  filePath: string,
): Promise<RecoveryVerification>;
