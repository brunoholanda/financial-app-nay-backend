import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Readable } from 'stream';
import { Repository } from 'typeorm';
import { BillReceiptUploadSession } from '../../database/entities/bill-receipt-upload-session.entity';
import { WorkspaceBill } from '../../database/entities/workspace-bill.entity';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../common/storage/object-storage.types';
import {
  BILL_RECEIPT_ALLOWED_MIME,
  BILL_RECEIPT_MAX_BYTES,
  BILL_RECEIPT_SESSION_TTL_MS,
  buildBillReceiptObjectKey,
  isBillReceiptObjectKey,
} from './bill-receipt.constants';

export type MemoryReceiptFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type ReceiptUploadResult = {
  receiptObjectKey: string;
  receiptMimeType: string;
  receiptOriginalFileName: string;
  receiptSizeBytes: number;
};

@Injectable()
export class BillReceiptService {
  constructor(
    @InjectRepository(WorkspaceBill)
    private readonly billRepo: Repository<WorkspaceBill>,
    @InjectRepository(BillReceiptUploadSession)
    private readonly sessionRepo: Repository<BillReceiptUploadSession>,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorage,
    private readonly config: ConfigService,
  ) {}

  private validateImage(file: MemoryReceiptFile): void {
    if (!file?.buffer?.length || !file.size) {
      throw new BadRequestException('Arquivo em falta ou vazio.');
    }
    if (file.size > BILL_RECEIPT_MAX_BYTES) {
      throw new BadRequestException(
        'O comprovante excede o limite de 3 MB após compressão.',
      );
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!BILL_RECEIPT_ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'Apenas imagens JPEG, PNG ou WebP são aceitas.',
      );
    }
  }

  private extForMime(mime: string): string {
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '.jpg';
  }

  private async putReceipt(
    workspaceId: string,
    billId: string,
    file: MemoryReceiptFile,
  ): Promise<ReceiptUploadResult> {
    this.validateImage(file);
    const mime = file.mimetype.toLowerCase();
    const ext =
      extname(file.originalname || '').toLowerCase() || this.extForMime(mime);
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
      ? ext === '.jpeg'
        ? '.jpg'
        : ext
      : this.extForMime(mime);
    const fileName = `${randomUUID()}${safeExt}`;
    const key = buildBillReceiptObjectKey(workspaceId, billId, fileName);
    await this.storage.putObject(key, file.buffer, mime);
    const original = (file.originalname || `comprovante${safeExt}`)
      .replace(/[\r\n"]/g, '')
      .slice(0, 512);
    return {
      receiptObjectKey: key,
      receiptMimeType: mime,
      receiptOriginalFileName: original,
      receiptSizeBytes: file.size,
    };
  }

  private async attachReceiptToBill(
    bill: WorkspaceBill,
    result: ReceiptUploadResult,
  ): Promise<void> {
    if (
      bill.receiptObjectKey &&
      bill.receiptObjectKey !== result.receiptObjectKey
    ) {
      await this.storage.deleteObject(bill.receiptObjectKey);
    }
    bill.receiptObjectKey = result.receiptObjectKey;
    bill.receiptMimeType = result.receiptMimeType;
    bill.receiptOriginalFileName = result.receiptOriginalFileName;
    bill.receiptSizeBytes = result.receiptSizeBytes;
    await this.billRepo.save(bill);
  }

  async uploadAuthenticated(
    workspaceId: string,
    billId: string,
    file: MemoryReceiptFile,
  ): Promise<ReceiptUploadResult> {
    const bill = await this.billRepo.findOne({
      where: { id: billId, workspaceId },
    });
    if (!bill) throw new NotFoundException('Conta não encontrada');
    if (bill.isPaid) {
      throw new BadRequestException(
        'Esta conta já está paga; não é possível anexar comprovante agora.',
      );
    }
    const result = await this.putReceipt(workspaceId, billId, file);
    await this.attachReceiptToBill(bill, result);
    return result;
  }

  async createSession(
    workspaceId: string,
    billId: string,
  ): Promise<{
    token: string;
    uploadUrl: string;
    expiresAt: string;
  }> {
    const bill = await this.billRepo.findOne({
      where: { id: billId, workspaceId },
    });
    if (!bill) throw new NotFoundException('Conta não encontrada');
    if (bill.isPaid) {
      throw new BadRequestException(
        'Esta conta já está paga; não é possível anexar comprovante agora.',
      );
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + BILL_RECEIPT_SESSION_TTL_MS);
    await this.sessionRepo.save(
      this.sessionRepo.create({
        token,
        billId,
        workspaceId,
        expiresAt,
        consumedAt: null,
        receiptObjectKey: null,
        receiptMimeType: null,
        receiptOriginalFileName: null,
        receiptSizeBytes: null,
      }),
    );

    const appUrl = (
      this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');

    return {
      token,
      uploadUrl: `${appUrl}/comprovante/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getSessionStatus(token: string): Promise<{
    status: 'pending' | 'ready' | 'expired' | 'consumed';
    billTitle?: string;
    receiptObjectKey?: string;
    receiptMimeType?: string;
    receiptOriginalFileName?: string;
    receiptSizeBytes?: number;
    expiresAt: string;
  }> {
    const session = await this.sessionRepo.findOne({
      where: { token },
      relations: ['bill'],
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    const expiresAt = session.expiresAt.toISOString();
    if (session.consumedAt) {
      return { status: 'consumed', expiresAt };
    }
    if (session.expiresAt.getTime() < Date.now()) {
      return { status: 'expired', expiresAt };
    }
    if (session.receiptObjectKey) {
      return {
        status: 'ready',
        billTitle: session.bill?.title,
        receiptObjectKey: session.receiptObjectKey,
        receiptMimeType: session.receiptMimeType ?? undefined,
        receiptOriginalFileName:
          session.receiptOriginalFileName ?? undefined,
        receiptSizeBytes: session.receiptSizeBytes ?? undefined,
        expiresAt,
      };
    }
    return {
      status: 'pending',
      billTitle: session.bill?.title,
      expiresAt,
    };
  }

  async uploadViaSession(
    token: string,
    file: MemoryReceiptFile,
  ): Promise<ReceiptUploadResult> {
    const session = await this.sessionRepo.findOne({ where: { token } });
    if (!session) throw new NotFoundException('Sessão não encontrada');
    if (session.consumedAt) {
      throw new BadRequestException('Esta sessão já foi utilizada.');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Sessão expirada. Gere um novo QR Code.');
    }
    if (session.receiptObjectKey) {
      throw new BadRequestException(
        'Já existe um comprovante nesta sessão. Feche e confirme no computador.',
      );
    }

    const result = await this.putReceipt(
      session.workspaceId,
      session.billId,
      file,
    );
    session.receiptObjectKey = result.receiptObjectKey;
    session.receiptMimeType = result.receiptMimeType;
    session.receiptOriginalFileName = result.receiptOriginalFileName;
    session.receiptSizeBytes = result.receiptSizeBytes;
    await this.sessionRepo.save(session);

    const bill = await this.billRepo.findOne({
      where: { id: session.billId, workspaceId: session.workspaceId },
    });
    if (bill && !bill.isPaid) {
      await this.attachReceiptToBill(bill, result);
    }

    return result;
  }

  /** Garante que a key do pay bate com o bill / R2 e marca a sessão como usada. */
  async resolveReceiptForPay(
    workspaceId: string,
    billId: string,
    receiptObjectKey: string | undefined,
  ): Promise<ReceiptUploadResult | null> {
    const bill = await this.billRepo.findOne({
      where: { id: billId, workspaceId },
    });
    if (!bill) throw new NotFoundException('Conta não encontrada');

    const key = (receiptObjectKey || bill.receiptObjectKey || '').trim();
    if (!key) return null;

    if (!isBillReceiptObjectKey(workspaceId, billId, key)) {
      throw new BadRequestException('Comprovante inválido para esta conta.');
    }
    if (!(await this.storage.exists(key))) {
      throw new BadRequestException(
        'Comprovante não encontrado no armazenamento.',
      );
    }

    const session = await this.sessionRepo.findOne({
      where: { billId, receiptObjectKey: key },
      order: { createdAt: 'DESC' },
    });

    const meta: ReceiptUploadResult = {
      receiptObjectKey: key,
      receiptMimeType:
        bill.receiptMimeType ||
        session?.receiptMimeType ||
        'image/jpeg',
      receiptOriginalFileName:
        bill.receiptOriginalFileName ||
        session?.receiptOriginalFileName ||
        'comprovante.jpg',
      receiptSizeBytes:
        bill.receiptSizeBytes || session?.receiptSizeBytes || 0,
    };

    if (bill.receiptObjectKey !== key) {
      await this.attachReceiptToBill(bill, meta);
    }

    if (session && !session.consumedAt) {
      session.consumedAt = new Date();
      await this.sessionRepo.save(session);
    }

    return meta;
  }

  async openReceiptStream(
    workspaceId: string,
    billId: string,
  ): Promise<{
    stream: Readable;
    mimeType: string;
    fileName: string;
  }> {
    const bill = await this.billRepo.findOne({
      where: { id: billId, workspaceId },
    });
    if (!bill?.receiptObjectKey) {
      throw new NotFoundException('Comprovante não encontrado');
    }
    try {
      const stream = await this.storage.getObjectStream(bill.receiptObjectKey);
      return {
        stream,
        mimeType: bill.receiptMimeType || 'image/jpeg',
        fileName: bill.receiptOriginalFileName || 'comprovante.jpg',
      };
    } catch {
      throw new NotFoundException('Arquivo do comprovante não encontrado');
    }
  }
}
