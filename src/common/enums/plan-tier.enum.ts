/**
 * Planos da licença. O Premium é o Padrão mais um adicional mensal e libera o
 * envio de documentos sem limite.
 */
export enum PlanTier {
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
}

export function isPlanTier(value: unknown): value is PlanTier {
  return value === PlanTier.STANDARD || value === PlanTier.PREMIUM;
}
