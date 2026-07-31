import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import Stripe from 'stripe';
import { BillingMailService } from './billing-mail.service';
import { User } from '../../database/entities/user.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { PlanTier, isPlanTier } from '../../common/enums/plan-tier.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  SubscriptionAccess,
  SubscriptionAccessService,
} from '../../common/services/subscription-access.service';
import {
  DOCUMENT_LIMIT_CODE,
  DocumentQuota,
  DocumentQuotaService,
} from '../../common/services/document-quota.service';

export type BillingPlanSummary = {
  trialDays: number;
  currency: string;
  /** Mensalidade do plano padrão. */
  priceCents: number;
  /** Adicional mensal do Premium. */
  premiumExtraCents: number;
  /** Mensalidade total do Premium (padrão + adicional). */
  premiumPriceCents: number;
  /** Documentos inclusos no plano padrão. */
  standardDocumentLimit: number;
};

export type BillingStatus = SubscriptionAccess & {
  /** true quando o usuário pode iniciar o checkout (MASTER + Stripe pronto). */
  canSubscribe: boolean;
  /** true quando já existe assinatura para gerenciar no portal do Stripe. */
  canManage: boolean;
  /** true quando cabe subir para o Premium. */
  canUpgrade: boolean;
  /** true quando cabe voltar para o plano padrão. */
  canDowngrade: boolean;
  paymentConfigured: boolean;
  documents: DocumentQuota;
};

/** Fatura do Stripe em formato enxuto, para a área de gestão. */
export type BillingInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  createdAt: string;
  periodEnd: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
};

export type PlanChangeResult = {
  /** «updated» quando a assinatura mudou na hora; «checkout» exige pagamento. */
  mode: 'updated' | 'checkout';
  /** Preenchido no modo «checkout». */
  url: string | null;
  status: BillingStatus;
};

/** Assinaturas que ainda podem ser alteradas no lugar. */
const CHANGEABLE_STATUSES: Stripe.Subscription.Status[] = [
  'active',
  'trialing',
  'past_due',
];

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private client: Stripe | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly access: SubscriptionAccessService,
    private readonly documentQuota: DocumentQuotaService,
    private readonly billingMail: BillingMailService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY')?.trim());
  }

  getPlan(): BillingPlanSummary {
    return {
      trialDays: this.access.trialDays,
      currency: this.access.currency,
      priceCents: this.access.priceCents,
      premiumExtraCents: this.access.premiumExtraCents,
      premiumPriceCents: this.access.premiumPriceCents,
      standardDocumentLimit: this.access.standardDocumentLimit,
    };
  }

  async getStatus(payload: JwtPayload): Promise<BillingStatus> {
    const access = await this.access.describeForJwt(payload);
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    const documents = await this.documentQuota.describe(payload);
    const isMaster = payload.role === UserRole.MASTER;
    const canChangePlan =
      isMaster && !access.licenseExempt && this.isConfigured();
    return {
      ...access,
      documents,
      paymentConfigured: this.isConfigured(),
      canSubscribe: canChangePlan,
      canManage:
        isMaster && this.isConfigured() && Boolean(user?.stripeCustomerId),
      canUpgrade: canChangePlan && access.planTier === PlanTier.STANDARD,
      canDowngrade: canChangePlan && access.planTier === PlanTier.PREMIUM,
    };
  }

  /** Checkout do Stripe para a licença mensal, no plano escolhido. */
  async createCheckoutSession(
    payload: JwtPayload,
    tier: PlanTier = PlanTier.STANDARD,
  ): Promise<{ url: string }> {
    const user = await this.requireMaster(payload);
    if (user.licenseExempt) {
      throw new BadRequestException('Esta conta não precisa de licença paga.');
    }
    return { url: await this.openCheckout(user, tier) };
  }

  /**
   * Troca de plano. Com assinatura ativa a mudança é aplicada no Stripe na hora
   * (com cobrança proporcional); sem assinatura, devolve o checkout do plano.
   */
  async changePlan(
    payload: JwtPayload,
    tier: PlanTier,
  ): Promise<PlanChangeResult> {
    const user = await this.requireMaster(payload);
    if (user.licenseExempt) {
      throw new BadRequestException(
        'Esta conta usa o sistema sem limite de documentos e não precisa de plano pago.',
      );
    }
    if (user.planTier === tier) {
      throw new BadRequestException(
        tier === PlanTier.PREMIUM
          ? 'A conta já está no plano Premium.'
          : 'A conta já está no plano padrão.',
      );
    }
    if (tier === PlanTier.STANDARD) {
      await this.assertFitsStandard(user);
    }

    const subscription = await this.findChangeableSubscription(user);
    if (!subscription) {
      const url = await this.openCheckout(user, tier);
      return { mode: 'checkout', url, status: await this.getStatus(payload) };
    }

    const item = subscription.items.data[0];
    if (!item) {
      const url = await this.openCheckout(user, tier);
      return { mode: 'checkout', url, status: await this.getStatus(payload) };
    }

    const updated = await this.stripe.subscriptions.update(subscription.id, {
      items: [
        { id: item.id, quantity: 1, ...this.subscriptionPrice(item, tier) },
      ],
      // Upgrade cobra a diferença na hora; downgrade gera crédito para a próxima fatura.
      proration_behavior:
        tier === PlanTier.PREMIUM ? 'always_invoice' : 'create_prorations',
      metadata: { ...subscription.metadata, userId: user.id, planTier: tier },
    });

    await this.applySubscription(user, updated);
    return {
      mode: 'updated',
      url: null,
      status: await this.getStatus(payload),
    };
  }

  /** Portal do Stripe para trocar cartão, ver faturas ou cancelar. */
  async createPortalSession(payload: JwtPayload): Promise<{ url: string }> {
    const user = await this.requireMaster(payload);
    if (!user.stripeCustomerId) {
      throw new BadRequestException(
        'Nenhuma assinatura encontrada para gerenciar.',
      );
    }
    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.appUrl()}/assinatura`,
    });
    return { url: session.url };
  }

  /**
   * Consulta o Stripe e atualiza a licença. Usado no retorno do checkout, para
   * não depender do webhook chegar primeiro.
   */
  async syncFromStripe(payload: JwtPayload): Promise<BillingStatus> {
    const user = await this.requireMaster(payload);
    if (user.stripeCustomerId) {
      const subs = await this.stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 10,
      });
      const current = this.pickCurrent(subs.data);
      if (current) {
        await this.applySubscription(user, current);
      }
    }
    return this.getStatus(payload);
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<{ received: boolean }> {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Webhook não configurado (STRIPE_WEBHOOK_SECRET).',
      );
    }
    if (!rawBody || !signature) {
      throw new BadRequestException('Requisição de webhook inválida.');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook rejeitado: ${message}`);
      throw new BadRequestException('Assinatura do webhook inválida.');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (subscriptionId) {
          const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
          await this.syncSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.syncSubscription(event.data.object);
        break;
      // Renovação mensal: cada fatura paga estende o acesso e avisa o cliente.
      case 'invoice.paid':
        await this.handleInvoice(event.data.object, 'paid');
        break;
      case 'invoice.payment_failed':
        await this.handleInvoice(event.data.object, 'failed');
        break;
      default:
        break;
    }

    return { received: true };
  }

  /**
   * Gestão: reconsulta o Stripe para um cliente específico e regrava a licença.
   * Devolve false quando a conta não tem cadastro no Stripe.
   */
  async syncUserById(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.stripeCustomerId || !this.isConfigured()) {
      return false;
    }
    const subs = await this.stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 10,
    });
    const current = this.pickCurrent(subs.data);
    if (!current) {
      return false;
    }
    await this.applySubscription(user, current);
    return true;
  }

  /** Gestão: histórico de faturas do cliente no Stripe. */
  async listInvoicesForUser(
    userId: string,
    limit = 12,
  ): Promise<BillingInvoice[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.stripeCustomerId || !this.isConfigured()) {
      return [];
    }
    const invoices = await this.stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit,
    });
    return invoices.data.map((invoice) => ({
      id: invoice.id ?? '',
      number: invoice.number ?? null,
      status: invoice.status ?? null,
      amountDueCents: invoice.amount_due ?? 0,
      amountPaidCents: invoice.amount_paid ?? 0,
      currency: (invoice.currency ?? this.access.currency).toUpperCase(),
      createdAt: new Date((invoice.created ?? 0) * 1000).toISOString(),
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
      hostedUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
    }));
  }

  /**
   * Rede de segurança para webhooks perdidos: reconsulta no Stripe as
   * assinaturas conhecidas e regrava a situação da licença.
   */
  async reconcileSubscriptions(): Promise<{
    checked: number;
    updated: number;
    failed: number;
  }> {
    if (!this.isConfigured()) {
      return { checked: 0, updated: 0, failed: 0 };
    }
    const users = await this.userRepo.find({
      where: { stripeSubscriptionId: Not(IsNull()) },
    });

    let updated = 0;
    let failed = 0;
    for (const user of users) {
      if (this.isLongChurned(user)) {
        continue;
      }
      try {
        const sub = await this.stripe.subscriptions.retrieve(
          user.stripeSubscriptionId as string,
        );
        const before = `${user.subscriptionStatus}|${user.subscriptionEndsAt?.toISOString() ?? ''}`;
        await this.applySubscription(user, sub);
        const after = `${user.subscriptionStatus}|${user.subscriptionEndsAt?.toISOString() ?? ''}`;
        if (before !== after) {
          updated += 1;
        }
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Não foi possível reconciliar a licença de ${user.email}: ${message}`,
        );
      }
    }
    return { checked: users.length, updated, failed };
  }

  /** Cancelada e sem acesso há mais de 30 dias: não vale consultar de novo. */
  private isLongChurned(user: User): boolean {
    if (user.subscriptionStatus !== SubscriptionStatus.CANCELED) return false;
    const end = user.subscriptionEndsAt?.getTime();
    return Boolean(end && Date.now() - end > 30 * 86_400_000);
  }

  private async handleInvoice(
    invoice: Stripe.Invoice,
    outcome: 'paid' | 'failed',
  ): Promise<void> {
    const subscriptionId = this.subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return;
    }
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    const user = await this.findUserForSubscription(sub);
    if (!user) {
      this.logger.warn(
        `Fatura ${invoice.id} sem usuário correspondente (assinatura ${sub.id}).`,
      );
      return;
    }
    await this.applySubscription(user, sub);

    if (outcome === 'paid') {
      await this.billingMail.sendPaymentConfirmed(user, {
        amountCents: invoice.amount_paid,
        currency: invoice.currency || this.access.currency,
        periodEnd: user.subscriptionEndsAt,
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      });
      return;
    }
    await this.billingMail.sendPaymentFailed(user, {
      nextAttempt: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000)
        : null,
      accessUntil: user.subscriptionEndsAt,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
    });
  }

  /** Nas versões atuais da API a assinatura vem em `parent`. */
  private subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const details = invoice.parent?.subscription_details?.subscription;
    if (!details) return null;
    return typeof details === 'string' ? details : details.id;
  }

  private get stripe(): Stripe {
    if (this.client) {
      return this.client;
    }
    const key = this.config.get<string>('STRIPE_SECRET_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'Pagamento indisponível: configure STRIPE_SECRET_KEY no servidor.',
      );
    }
    this.client = new Stripe(key);
    return this.client;
  }

  private async openCheckout(user: User, tier: PlanTier): Promise<string> {
    const customer = await this.ensureCustomer(user);
    const appUrl = this.appUrl();

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        payment_method_types: this.paymentMethodTypes(),
        line_items: [this.lineItem(tier)],
        locale: 'pt-BR',
        allow_promotion_codes: true,
        client_reference_id: user.id,
        metadata: { userId: user.id, planTier: tier },
        subscription_data: { metadata: { userId: user.id, planTier: tier } },
        success_url: `${appUrl}/assinatura?status=sucesso`,
        cancel_url: `${appUrl}/assinatura?status=cancelado`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha ao abrir o checkout no Stripe: ${message}`);
      throw new ServiceUnavailableException(
        'Não foi possível abrir o pagamento. Verifique a configuração da conta no Stripe e tente novamente.',
      );
    }

    if (!session.url) {
      throw new ServiceUnavailableException(
        'Não foi possível abrir o checkout. Tente novamente.',
      );
    }
    return session.url;
  }

  /**
   * Sem isso o Stripe usa os meios de pagamento dinâmicos do painel e recusa a
   * sessão quando nenhum deles aceita a moeda ("No valid payment method types
   * for this Checkout Session"). Cartão é o único que cobre assinatura mensal em
   * BRL; para aceitar outros, liste em STRIPE_PAYMENT_METHOD_TYPES.
   */
  private paymentMethodTypes(): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
    const configured = (
      this.config.get<string>('STRIPE_PAYMENT_METHOD_TYPES') ?? ''
    )
      .split(/[,;]+/g)
      .map((type) => type.trim().toLowerCase())
      .filter(Boolean);
    return configured.length ? configured : ['card'];
  }

  private lineItem(
    tier: PlanTier,
  ): Stripe.Checkout.SessionCreateParams.LineItem {
    const priceId = this.priceIdFor(tier);
    if (priceId) {
      return { price: priceId, quantity: 1 };
    }
    // Sem preço cadastrado no Stripe, criamos a assinatura na hora.
    return {
      quantity: 1,
      price_data: {
        currency: this.access.currency.toLowerCase(),
        unit_amount: this.access.priceCentsFor(tier),
        recurring: { interval: 'month' },
        product_data: {
          name: this.planName(tier),
          description: this.planDescription(tier),
        },
      },
    };
  }

  /** Preço do item ao trocar de plano: id configurado ou valor avulso. */
  private subscriptionPrice(
    item: Stripe.SubscriptionItem,
    tier: PlanTier,
  ):
    | { price: string }
    | { price_data: Stripe.SubscriptionUpdateParams.Item.PriceData } {
    const priceId = this.priceIdFor(tier);
    if (priceId) {
      return { price: priceId };
    }
    const product = item.price?.product;
    const productId = typeof product === 'string' ? product : product?.id;
    if (!productId) {
      throw new ServiceUnavailableException(
        'Não foi possível identificar o produto da assinatura no Stripe.',
      );
    }
    return {
      price_data: {
        currency: this.access.currency.toLowerCase(),
        product: productId,
        recurring: { interval: 'month' },
        unit_amount: this.access.priceCentsFor(tier),
      },
    };
  }

  private priceIdFor(tier: PlanTier): string | null {
    const key =
      tier === PlanTier.PREMIUM ? 'STRIPE_PREMIUM_PRICE_ID' : 'STRIPE_PRICE_ID';
    return this.config.get<string>(key)?.trim() || null;
  }

  private planName(tier: PlanTier): string {
    return tier === PlanTier.PREMIUM
      ? 'App Financeiro — licença Premium'
      : 'App Financeiro — licença de uso';
  }

  private planDescription(tier: PlanTier): string {
    return tier === PlanTier.PREMIUM
      ? 'Acesso completo ao painel e documentos sem limite, por mês.'
      : `Acesso completo ao painel e até ${this.access.standardDocumentLimit} documentos, por mês.`;
  }

  /** Assinatura que ainda aceita troca de plano no lugar. */
  private async findChangeableSubscription(
    user: User,
  ): Promise<Stripe.Subscription | null> {
    if (!user.stripeCustomerId) {
      return null;
    }
    const subs = await this.stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 10,
      expand: ['data.items.data.price'],
    });
    const current = this.pickCurrent(subs.data);
    if (!current || !CHANGEABLE_STATUSES.includes(current.status)) {
      return null;
    }
    return current.cancel_at_period_end ? null : current;
  }

  /** Voltar ao padrão só é possível se os documentos couberem na cota. */
  private async assertFitsStandard(owner: User): Promise<void> {
    const used = await this.documentQuota.countForOwner(owner.id);
    const limit = this.access.standardDocumentLimit;
    if (used <= limit) {
      return;
    }
    throw new BadRequestException({
      code: DOCUMENT_LIMIT_CODE,
      message: `A conta tem ${used} documentos e o plano padrão inclui ${limit}. Exclua ${used - limit} documento(s) antes de voltar ao plano padrão.`,
    });
  }

  private async ensureCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    user.stripeCustomerId = customer.id;
    await this.userRepo.save(user);
    return customer.id;
  }

  private async requireMaster(payload: JwtPayload): Promise<User> {
    if (payload.role !== UserRole.MASTER) {
      throw new ForbiddenException(
        'Somente o administrador da conta gerencia a licença. Fale com o responsável pelo seu espaço.',
      );
    }
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  private async syncSubscription(sub: Stripe.Subscription): Promise<void> {
    const user = await this.findUserForSubscription(sub);
    if (!user) {
      this.logger.warn(
        `Webhook sem usuário correspondente (assinatura ${sub.id}).`,
      );
      return;
    }
    await this.applySubscription(user, sub);
  }

  private async applySubscription(
    user: User,
    sub: Stripe.Subscription,
  ): Promise<void> {
    user.stripeSubscriptionId = sub.id;
    user.stripeCustomerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    user.subscriptionStatus = this.mapStatus(sub);
    user.subscriptionEndsAt = this.resolvePeriodEnd(sub);
    user.planTier = this.resolveTier(sub);
    await this.userRepo.save(user);
    this.access.invalidate(user.id);
    this.logger.log(
      `Licença de ${user.email}: ${user.subscriptionStatus} (${user.planTier}) até ${
        user.subscriptionEndsAt?.toISOString() ?? 'sem data'
      }`,
    );
  }

  /**
   * O Stripe é a fonte da verdade do plano: usa a etiqueta gravada na
   * assinatura e, na falta dela, o preço cobrado.
   */
  private resolveTier(sub: Stripe.Subscription): PlanTier {
    const tagged = sub.metadata?.planTier;
    if (isPlanTier(tagged)) {
      return tagged;
    }
    const premiumPriceId = this.priceIdFor(PlanTier.PREMIUM);
    const items = sub.items?.data ?? [];
    if (
      premiumPriceId &&
      items.some((item) => item.price?.id === premiumPriceId)
    ) {
      return PlanTier.PREMIUM;
    }
    const total = items.reduce(
      (sum, item) =>
        sum + (item.price?.unit_amount ?? 0) * (item.quantity ?? 1),
      0,
    );
    return total >= this.access.premiumPriceCents
      ? PlanTier.PREMIUM
      : PlanTier.STANDARD;
  }

  private async findUserForSubscription(
    sub: Stripe.Subscription,
  ): Promise<User | null> {
    const userId = sub.metadata?.userId;
    if (userId) {
      const byMetadata = await this.userRepo.findOne({ where: { id: userId } });
      if (byMetadata) return byMetadata;
    }
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    return this.userRepo.findOne({ where: { stripeCustomerId: customerId } });
  }

  /** Prioriza a assinatura que ainda dá acesso; senão, a mais recente. */
  private pickCurrent(subs: Stripe.Subscription[]): Stripe.Subscription | null {
    if (!subs.length) return null;
    const priority: Stripe.Subscription.Status[] = [
      'active',
      'trialing',
      'past_due',
      'unpaid',
      'incomplete',
    ];
    for (const status of priority) {
      const found = subs.find((s) => s.status === status);
      if (found) return found;
    }
    return [...subs].sort((a, b) => b.created - a.created)[0] ?? null;
  }

  private mapStatus(sub: Stripe.Subscription): SubscriptionStatus {
    switch (sub.status) {
      case 'active':
      case 'trialing':
        return sub.cancel_at_period_end
          ? SubscriptionStatus.CANCELED
          : SubscriptionStatus.ACTIVE;
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
      case 'paused':
        return SubscriptionStatus.PAST_DUE;
      default:
        return SubscriptionStatus.CANCELED;
    }
  }

  /** O fim do período vive no item da assinatura nas versões atuais da API. */
  private resolvePeriodEnd(sub: Stripe.Subscription): Date | null {
    const itemEnd = sub.items?.data?.[0]?.current_period_end;
    const seconds = itemEnd ?? sub.trial_end ?? sub.cancel_at ?? sub.ended_at;
    return seconds ? new Date(seconds * 1000) : null;
  }

  private appUrl(): string {
    return (
      this.config.get<string>('APP_PUBLIC_URL') ??
      'https://financial.brunoholanda.com'
    ).replace(/\/$/, '');
  }
}
