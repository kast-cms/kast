import { ValidationPipe } from '@nestjs/common';
import { FormFieldType } from '@prisma/client';
import { CreateFormDto, MarkSubmissionReadDto } from './form.dto';

/** The pipe main.ts installs, including the implicit conversion it enables. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

describe('form DTO boolean flags', () => {
  it('does not activate a form, or make a field required, on a string "false"', async () => {
    const dto = (await pipe.transform(
      {
        name: 'Contact',
        slug: 'contact',
        isActive: 'false',
        fields: [
          {
            name: 'message',
            label: 'Message',
            type: FormFieldType.TEXT,
            isRequired: 'false',
          },
        ],
      },
      { type: 'body', metatype: CreateFormDto },
    )) as CreateFormDto;

    expect(dto.isActive).toBe(false);
    expect(dto.fields[0]?.isRequired).toBe(false);
  });

  it('reads isRead="false" as unread', async () => {
    const dto = (await pipe.transform(
      { isRead: 'false' },
      { type: 'body', metatype: MarkSubmissionReadDto },
    )) as MarkSubmissionReadDto;

    expect(dto.isRead).toBe(false);
  });
});
