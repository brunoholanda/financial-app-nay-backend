import { WorkspaceDocumentKind } from '../enums/workspace-document-kind.enum';

/** Prefixo no bucket R2 (pastas documentos/ e comprovantes/). */
export function documentStoragePrefix(
  kind: WorkspaceDocumentKind,
): 'documentos' | 'comprovantes' {
  return String(kind).startsWith('COMPROVANTE_')
    ? 'comprovantes'
    : 'documentos';
}

/** Key S3: {prefix}/{workspaceId}/{uuid}.ext */
export function buildDocumentObjectKey(
  workspaceId: string,
  kind: WorkspaceDocumentKind,
  fileName: string,
): string {
  return `${documentStoragePrefix(kind)}/${workspaceId}/${fileName}`;
}

/** True se a key é do bucket R2 (documentos/ ou comprovantes/). */
export function isR2ObjectKey(storedFileName: string): boolean {
  return (
    storedFileName.startsWith('documentos/') ||
    storedFileName.startsWith('comprovantes/')
  );
}

/** @deprecated use isR2ObjectKey */
export const isFullObjectKey = isR2ObjectKey;

/** Filtro SQL: só metadados apontando para o R2. */
export const R2_OBJECT_KEY_SQL = `(d.stored_file_name LIKE 'documentos/%' OR d.stored_file_name LIKE 'comprovantes/%')`;
