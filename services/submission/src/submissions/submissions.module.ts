import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { FormSubmission, FormSubmissionSchema } from '../schemas/submission.schema';
import { FormDataAuditLog, FormDataAuditLogSchema } from '../schemas/form-audit-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FormSubmission.name, schema: FormSubmissionSchema },
      { name: FormDataAuditLog.name, schema: FormDataAuditLogSchema },
    ]),
  ],
  providers: [SubmissionsService],
  controllers: [SubmissionsController],
})
export class SubmissionsModule {}
