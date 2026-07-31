import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Espaços de trabalho')
@ApiBearerAuth()
@Controller('workspaces')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MASTER)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.workspacesService.listForMaster(user.sub);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(user.sub, id, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.workspacesService.getOneForMaster(user.sub, id);
  }
}
