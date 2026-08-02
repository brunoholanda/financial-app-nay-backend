export const BILL_RECEIPT_MAX_BYTES = 3 * 1024 * 1024;

export const BILL_RECEIPT_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const BILL_RECEIPT_SESSION_TTL_MS = 10 * 60 * 1000;

export function buildBillReceiptObjectKey(
  workspaceId: string,
  billId: string,
  fileName: string,
): string {
  return `comprovantes/${workspaceId}/bills/${billId}/${fileName}`;
}

export function isBillReceiptObjectKey(
  workspaceId: string,
  billId: string,
  key: string,
): boolean {
  return key.startsWith(`comprovantes/${workspaceId}/bills/${billId}/`);
}
