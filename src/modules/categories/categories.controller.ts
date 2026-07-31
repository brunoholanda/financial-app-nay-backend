import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';

@ApiTags('Categorias')
@ApiBearerAuth()
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  @Post()
  @Roles(UserRole.MASTER)
  async create(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: CreateCategoryDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers,
    );
    return this.categoriesService.create(workspaceId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Query() query: ListCategoriesQueryDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers,
    );
    return this.categoriesService.list(workspaceId, query);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER)
  async update(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers,
    );
    return this.categoriesService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers,
    );
    return this.categoriesService.remove(workspaceId, id);
  }
}
