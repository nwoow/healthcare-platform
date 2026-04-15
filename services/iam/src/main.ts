import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { RolesService } from './roles/roles.service';
import { PermissionsService } from './permissions/permissions.service';
import { seedSystemRoles } from './seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('IAM Service')
    .setDescription('Identity & Access Management API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Seed system roles on startup
  const prisma = app.get(PrismaService);
  const rolesService = app.get(RolesService);
  const permissionsService = app.get(PermissionsService);
  await seedSystemRoles(prisma, rolesService, permissionsService);

  await app.listen(process.env.PORT ?? 3002);
  console.log(`IAM service running on port ${process.env.PORT ?? 3002}`);
}
bootstrap();
