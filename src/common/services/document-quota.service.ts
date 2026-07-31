import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Workspace } from '../../database/entities/workspace.entity';
import { WorkspaceDocument } from '../../database/entities/workspace-document.entity';
import { PlanTier } from '../enums/plan-tier.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { SubscriptionAccessService } from './subscription-access.service';

/** Código devolvido no 403 para o frontend oferecer o upgrade. */
export const DOCUMENT_LIMIT_CODE = 'DOCUMENT_LIMIT_REACHED';

export type DocumentQuota = {
  planTier: PlanTier;
  /** Documentos já enviados na conta (soma de todos os espaços do titular). */
  used: number;
  /** Teto do plano em vigor; null quando é sem limite (Premium/isento). */
  limit: number | null;
  /** Quanto ainda cabe; null quando é sem limite. */
  remaining: number | null;
  limitReached: boolean;
  /** Teto do plano padrão, para explicar o upgrade. */
  standardLimit: number;
  /** Adicional mensal do Premium, em centavos. */
  premiumExtraCents: number;
  premiumPriceCents: number;
  currency: string;
  /** true quando quem paga a licença é o MASTER dono do espaço. */
  managedByOwner: boolean;
};

/**
 * Cota de documentos da licença: o plano padrão inclui um número fixo de
 * arquivos e o Premium libera o envio sem limite. A contagem é por conta
 * titular (MASTER), somando todos os espaços que ela criou.
 */
@Injectable()
export class DocumentQuotaService {
  constructor(
    @InjectRepository(WorkspaceDocument)
    private readonly documentRepo: Repository<WorkspaceDocument>,
    private readonly access: SubscriptionAccessService,
  ) {}

  async describe(payload: JwtPayload): Promise<DocumentQuota> {
    const owner = await this.access.resolveLicenseOwner(payload);
    const used = owner ? await this.countForOwner(owner.id) : 0;
    return this.build(owner, used, owner?.id !== payload.sub);
  }

  async describeForOwner(owner: User): Promise<DocumentQuota> {
    const used = await this.countForOwner(owner.id);
    return this.build(owner, used, false);
  }

  /** Bloqueia o envio quando o plano padrão já usou toda a cota. */
  async assertCanUpload(payload: JwtPayload): Promise<DocumentQuota> {
    const quota = await this.describe(payload);
    if (!quota.limitReached) {
      return quota;
    }
    throw new ForbiddenException({
      code: DOCUMENT_LIMIT_CODE,
      message: `O plano padrão inclui até ${quota.limit} documentos e a conta já usa ${quota.used}. Faça o upgrade para o Premium para enviar documentos sem limite.`,
      quota,
    });
  }

  async countForOwner(ownerId: string): Promise<number> {
    return this.documentRepo
      .createQueryBuilder('d')
      .innerJoin(Workspace, 'w', 'w.id = d.workspaceId')
      .where('w.createdById = :ownerId', { ownerId })
      .getCount();
  }

  private build(
    owner: User | null,
    used: number,
    managedByOwner: boolean,
  ): DocumentQuota {
    const planTier =
      owner?.licenseExempt || owner?.planTier === PlanTier.PREMIUM
        ? PlanTier.PREMIUM
        : PlanTier.STANDARD;
    const limit = this.access.documentLimitFor(planTier);
    return {
      planTier,
      used,
      limit,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      limitReached: limit !== null && used >= limit,
      standardLimit: this.access.standardDocumentLimit,
      premiumExtraCents: this.access.premiumExtraCents,
      premiumPriceCents: this.access.premiumPriceCents,
      currency: this.access.currency,
      managedByOwner,
    };
  }
}
