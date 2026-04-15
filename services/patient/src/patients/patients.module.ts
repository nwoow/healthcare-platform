import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PrismaModule } from '../prisma/prisma.module'
import { PatientsService } from './patients.service'
import { PatientsController } from './patients.controller'
import { PatientHistory, PatientHistorySchema } from './schemas/patient-history.schema'
import { ConsentArtifact, ConsentArtifactSchema } from '../consent/consent.schema'
import { FhirService } from '../fhir/fhir.service'

@Module({
  imports: [
    PrismaModule,
    MongooseModule.forFeature([
      { name: PatientHistory.name, schema: PatientHistorySchema },
      { name: ConsentArtifact.name, schema: ConsentArtifactSchema },
    ]),
  ],
  providers: [PatientsService, FhirService],
  controllers: [PatientsController],
})
export class PatientsModule {}
