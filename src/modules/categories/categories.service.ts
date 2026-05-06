import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../database/entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async create(workspaceId: string, dto: CreateCategoryDto) {
    const entity = this.categoryRepo.create({
      ...dto,
      workspaceId,
    });
    return this.categoryRepo.save(entity);
  }

  list(workspaceId: string) {
    return this.categoryRepo.find({
      where: { workspaceId },
      order: { name: 'ASC' },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateCategoryDto) {
    const cat = await this.categoryRepo.findOne({ where: { id, workspaceId } });
    if (!cat) {
      throw new NotFoundException('Category not found');
    }
    Object.assign(cat, dto);
    return this.categoryRepo.save(cat);
  }

  async remove(workspaceId: string, id: string) {
    const cat = await this.categoryRepo.findOne({ where: { id, workspaceId } });
    if (!cat) {
      throw new NotFoundException('Category not found');
    }
    await this.categoryRepo.remove(cat);
    return { id };
  }

  async assertCategoryInWorkspace(workspaceId: string, categoryId: string) {
    const ok = await this.categoryRepo.exist({
      where: { id: categoryId, workspaceId },
    });
    if (!ok) {
      throw new ForbiddenException('Category does not belong to workspace');
    }
  }

  async findOneInWorkspace(
    workspaceId: string,
    categoryId: string,
  ): Promise<Category> {
    const cat = await this.categoryRepo.findOne({
      where: { id: categoryId, workspaceId },
    });
    if (!cat) {
      throw new NotFoundException('Category not found');
    }
    return cat;
  }
}
