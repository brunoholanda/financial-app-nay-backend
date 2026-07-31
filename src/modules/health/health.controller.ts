import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Endpoint público de status, sem autenticação: é o alvo da relação `status` no
 * catálogo de API (/.well-known/api-catalog) e serve para monitoramento externo.
 * Responde só o que já é público — nada de configuração ou contagem de usuários.
 */
@ApiTags('Status')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Estado do serviço',
    description:
      'Responde 200 quando a API está de pé. Não exige autenticação.',
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
