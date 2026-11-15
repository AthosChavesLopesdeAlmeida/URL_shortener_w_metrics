// O Drizzle embrulha o erro do driver em `cause`, então checamos os dois lugares
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.cause?.code ?? e?.code;
}

// 23503 = foreign_key_violation (o link foi excluído antes de o clique ser processado)
export const isForeignKeyViolation = (err: unknown) => pgErrorCode(err) === '23503';