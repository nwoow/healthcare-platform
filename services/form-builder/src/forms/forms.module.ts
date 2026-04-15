import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { FormSchema, FormSchemaSchema } from '../schemas/form.schema';
import { FormVersion, FormVersionSchema } from '../schemas/form-version.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FormSchema.name, schema: FormSchemaSchema },
      { name: FormVersion.name, schema: FormVersionSchema },
    ]),
  ],
  providers: [FormsService],
  controllers: [FormsController],
})
export class FormsModule {}
