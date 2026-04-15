import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { PrismaModule } from './prisma/prisma.module'
import { PatientsModule } from './patients/patients.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({ uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_patients' }),
    }),
    PrismaModule,
    PatientsModule,
  ],
})
export class AppModule {}
