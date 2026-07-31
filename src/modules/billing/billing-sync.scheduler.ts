import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class BillingSyncScheduler {
  private readonly logger = new Logger(BillingSyncScheduler.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Todos os dias às 05:00 (Brasília): confere no Stripe as renovações do mês.
   * O webhook já faz isso em tempo real; aqui é a rede de segurança para
   * eventos perdidos (servidor fora do ar, endpoint com falha).
   */
  @Cron('0 5 * * *', {
    name: 'billing-subscription-sync',
    timeZone: 'America/Sao_Paulo',
  })
  async handleDailySync() {
    const enabled =
      (
        this.config.get<string>('BILLING_SYNC_CRON_ENABLED') ?? 'true'
      ).toLowerCase() !== 'false';
    if (!enabled) {
      this.logger.debug(
        'Cron de assinaturas desabilitado (BILLING_SYNC_CRON_ENABLED=false).',
      );
      return;
    }

    try {
      const result = await this.billingService.reconcileSubscriptions();
      this.logger.log(
        `Cron assinaturas: checked=${result.checked} updated=${result.updated} failed=${result.failed}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Cron de assinaturas falhou: ${message}`);
    }
  }
}
