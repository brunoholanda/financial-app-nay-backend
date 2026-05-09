import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkspaceDocumentKind } from '../../common/enums/workspace-document-kind.enum';
import { WorkspaceDocumentScope } from '../../common/enums/workspace-document-scope.enum';
import { Workspace } from './workspace.entity';

@Entity('workspace_documents')
export class WorkspaceDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({
    type: 'enum',
    enum: WorkspaceDocumentKind,
  })
  kind: WorkspaceDocumentKind;

  /** Pessoa física ou jurídica — agrupa documentos na área do sistema */
  @Column({
    type: 'enum',
    enum: WorkspaceDocumentScope,
    name: 'person_scope',
    default: WorkspaceDocumentScope.PF,
  })
  personScope: WorkspaceDocumentScope;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 512, name: 'original_file_name' })
  originalFileName: string;

  /** Nome do ficheiro no disco (ex.: {uuid}.pdf), dentro da pasta do workspace */
  @Column({ type: 'varchar', length: 280, name: 'stored_file_name' })
  storedFileName: string;

  @Column({ type: 'varchar', length: 200, name: 'mime_type' })
  mimeType: string;

  @Column({ type: 'int', name: 'size_bytes' })
  sizeBytes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
