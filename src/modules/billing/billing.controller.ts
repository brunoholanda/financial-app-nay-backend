import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PlanTier } from '../../common/enums/plan-tier.enum';
import { ChangePlanDto, CheckoutDto } from './dto/plan-tier.dto';

@ApiTags('Assinatura')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /** Público: valores exibidos na página de cadastro e na landing. */
  @Get('plan')
  plan() {
    return this.billingService.getPlan();
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  subscription(@CurrentUser() user: JwtPayload) {
    return this.billingService.getStatus(user);
  }

  /** Cada chamada abre uma sessão no Stripe: limite acima do uso normal. */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 12, ttl: 600_000 } })
  checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto) {
    return this.billingService.createCheckoutSession(
      user,
      dto.tier ?? PlanTier.STANDARD,
    );
  }

  /** Upgrade para o Premium ou volta ao plano padrão. */
  @Post('plan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePlan(@CurrentUser() user: JwtPayload, @Body() dto: ChangePlanDto) {
    return this.billingService.changePlan(user, dto.tier);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 12, ttl: 600_000 } })
  portal(@CurrentUser() user: JwtPayload) {
    return this.billingService.createPortalSession(user);
  }

  /** Reconsulta o Stripe (retorno do checkout, antes do webhook chegar). */
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  sync(@CurrentUser() user: JwtPayload) {
    return this.billingService.syncFromStripe(user);
  }

  @Post('webhook')
  @HttpCode(200)
  // Só o Stripe chama, com assinatura própria: fora da especificação pública.
  @ApiExcludeEndpoint()
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.billingService.handleWebhook(req.rawBody, signature);
  }
}
