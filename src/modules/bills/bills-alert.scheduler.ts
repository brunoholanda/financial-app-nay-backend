import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BillsAlertDigestService } from './bills-alert-digest.service';

@Injectable()
export class BillsAlertScheduler {
  private readonly logger = new Logger(BillsAlertScheduler.name);

  constructor(
    private readonly digestService: BillsAlertDigestService,
    private readonly config: ConfigService,
  ) {}

  /** Todos os dias às 08:00 no horário de Brasília. */
  @Cron('0 8 * * *', {
    name: 'bills-alert-digest',
    timeZone: 'America/Sao_Paulo',
  })
  async handleDailyDigest() {
    const enabled =
      (this.config.get<string>('BILL_ALERT_CRON_ENABLED') ?? 'true').toLowerCase() !==
      'false';
    if (!enabled) {
      this.logger.debug('Cron de contas desabilitado (BILL_ALERT_CRON_ENABLED=false).');
      return;
    }

    try {
      const result = await this.digestService.runDigest();
      this.logger.log(
        `Cron digest: sent=${result.sent} skipped=${result.skipped} reason=${result.reason ?? '-'}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Cron digest falhou: ${message}`);
    }
  }
}
