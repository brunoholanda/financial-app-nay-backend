import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { MailService } from './mail.service';
import { SendTestMailDto } from './dto/send-test-mail.dto';

@Controller('mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MASTER)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('status')
  status() {
    return {
      configured: this.mailService.isConfigured(),
    };
  }

  @Post('test')
  async sendTest(@Body() dto: SendTestMailDto) {
    await this.mailService.verifyConnection();
    const subject =
      dto.subject?.trim() || 'Teste SMTP — App Financeiro';
    const result = await this.mailService.send({
      to: dto.to,
      subject,
      text: [
        'Este é um e-mail de teste do App Financeiro.',
        '',
        `Enviado em: ${new Date().toISOString()}`,
        'Remetente configurado via SMTP (HostGator/Titan).',
      ].join('\n'),
      html: `<p>Este é um e-mail de teste do <strong>App Financeiro</strong>.</p>
<p>Enviado em: ${new Date().toISOString()}</p>
<p>Remetente configurado via SMTP (HostGator/Titan).</p>`,
    });
    return { ok: true, ...result };
  }
}
