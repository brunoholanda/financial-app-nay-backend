import { IsBoolean } from 'class-validator';

export class SetClientActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
