import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { addDays } from 'date-fns';
import { Kafka } from 'kafkajs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  private async publishKafka(topic: string, message: object, key: string): Promise<void> {
    const kafka = new Kafka({
      clientId: 'auth-service',
      brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
    });
    const producer = kafka.producer();
    try {
      await producer.connect();
      await producer.send({
        topic,
        messages: [{ key, value: JSON.stringify(message) }],
      });
    } catch (err) {
      // fire-and-forget: swallow errors so Kafka never breaks auth flow
    } finally {
      try { await producer.disconnect(); } catch {}
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      this.publishKafka('auth.login.failed', { email, reason: 'invalid_credentials', timestamp: new Date() }, email).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(user: { id: string; email: string }) {
    // Fetch full user to get tenantId
    const fullUser = await this.usersService.findById(user.id);
    const payload = { sub: user.id, email: user.email, tenantId: fullUser?.tenantId };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (process.env.JWT_EXPIRY || '15m') as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: (process.env.REFRESH_TOKEN_EXPIRY || '7d') as any,
      secret: (process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production') + '_refresh',
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: addDays(new Date(), 7),
      },
    });

    this.publishKafka('auth.login.success', { userId: user.id, email: user.email, timestamp: new Date() }, user.id).catch(() => {});

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, tenantId: fullUser?.tenantId } };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: (process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production') + '_refresh',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = this.jwtService.sign(
      { sub: payload.sub, email: payload.email },
      { expiresIn: (process.env.JWT_EXPIRY || '15m') as any },
    );

    return { accessToken };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }
}
