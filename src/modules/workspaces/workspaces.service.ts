import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../../database/entities/workspace.entity';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
  ) {}

  create(masterId: string, dto: CreateWorkspaceDto) {
    const ws = this.workspaceRepo.create({
      name: dto.name.trim(),
      businessType: dto.businessType.trim(),
      createdById: masterId,
      pixKeyPrimary: dto.pixKeyPrimary?.trim() || null,
      pixKeySecondary: dto.pixKeySecondary?.trim() || null,
      bankingHolderName: dto.bankingHolderName?.trim() || null,
      bankingDocument: dto.bankingDocument?.trim() || null,
      bankingNotes: dto.bankingNotes?.trim() || null,
    });
    return this.workspaceRepo.save(ws);
  }

  listForMaster(masterId: string) {
    return this.workspaceRepo.find({
      where: { createdById: masterId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOneForMaster(masterId: string, id: string) {
    const ws = await this.workspaceRepo.findOne({
      where: { id, createdById: masterId },
      relations: { categories: true, accounts: true },
    });
    if (!ws) {
      throw new NotFoundException('Workspace not found');
    }
    return ws;
  }

  async update(masterId: string, id: string, dto: UpdateWorkspaceDto) {
    const ws = await this.workspaceRepo.findOne({
      where: { id, createdById: masterId },
    });
    if (!ws) throw new NotFoundException('Workspace not found');
    if (dto.name !== undefined) ws.name = dto.name.trim();
    if (dto.businessType !== undefined)
      ws.businessType = dto.businessType.trim();
    if (dto.pixKeyPrimary !== undefined)
      ws.pixKeyPrimary = dto.pixKeyPrimary?.trim() || null;
    if (dto.pixKeySecondary !== undefined)
      ws.pixKeySecondary = dto.pixKeySecondary?.trim() || null;
    if (dto.bankingHolderName !== undefined)
      ws.bankingHolderName = dto.bankingHolderName?.trim() || null;
    if (dto.bankingDocument !== undefined)
      ws.bankingDocument = dto.bankingDocument?.trim() || null;
    if (dto.bankingNotes !== undefined)
      ws.bankingNotes = dto.bankingNotes?.trim() || null;
    return this.workspaceRepo.save(ws);
  }
}
