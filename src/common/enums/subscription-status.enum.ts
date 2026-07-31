/** Situação da licença de uso da conta MASTER. */
export enum SubscriptionStatus {
  /** Teste grátis em andamento. */
  TRIALING = 'TRIALING',
  /** Licença paga e vigente. */
  ACTIVE = 'ACTIVE',
  /** Cobrança falhou; acesso segue até o fim do período pago. */
  PAST_DUE = 'PAST_DUE',
  /** Cancelada; acesso segue até o fim do período já pago. */
  CANCELED = 'CANCELED',
  /** Teste terminou sem assinatura. */
  EXPIRED = 'EXPIRED',
}
