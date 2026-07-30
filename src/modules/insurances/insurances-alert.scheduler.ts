import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InsurancesAlertDigestService } from './insurances-alert-digest.service';

@Injectable()
export class InsurancesAlertScheduler {
  private readonly logger = new Logger(InsurancesAlertScheduler.name);

  constructor(
    private readonly digestService: InsurancesAlertDigestService,
    private readonly config: ConfigService,
  ) {}

  /** Todos os dias às 08:00 no horário de Brasília (junto com contas). */
  @Cron('0 8 * * *', {
    name: 'insurances-alert-digest',
    timeZone: 'America/Sao_Paulo',
  })
  async handleDailyDigest() {
    const enabled =
      (
        this.config.get<string>('INSURANCE_ALERT_CRON_ENABLED') ?? 'true'
      ).toLowerCase() !== 'false';
    if (!enabled) {
      this.logger.debug(
        'Cron de seguros desabilitado (INSURANCE_ALERT_CRON_ENABLED=false).',
      );
      return;
    }

    try {
      const result = await this.digestService.runDigest();
      this.logger.log(
        `Cron digest seguros: sent=${result.sent} skipped=${result.skipped} reason=${result.reason ?? '-'}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Cron digest seguros falhou: ${message}`);
    }
  }
}
