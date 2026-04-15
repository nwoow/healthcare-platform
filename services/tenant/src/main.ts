import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableCors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true })

  const config = new DocumentBuilder()
    .setTitle('Tenant Service')
    .setDescription('Multi-tenant provisioning API')
    .setVersion('1.0')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config))

  const port = process.env.PORT ?? 3010
  await app.listen(port)
  console.log(`Tenant service running on port ${port}`)
}
bootstrap()
