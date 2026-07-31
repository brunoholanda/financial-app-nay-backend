import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../../database/entities/user.entity';
import { LoginChallenge } from '../../database/entities/login-challenge.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginTwoFactorService } from './login-two-factor.service';
import { SignupService } from './signup.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            Number.parseInt(config.get<string>('JWT_EXPIRES_SEC') ?? '', 10) ||
            604800,
        },
      }),
    }),
    TypeOrmModule.forFeature([User, LoginChallenge]),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginTwoFactorService, SignupService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
