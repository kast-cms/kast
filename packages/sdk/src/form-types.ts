export type FormFieldType =
  | 'TEXT'
  | 'EMAIL'
  | 'PHONE'
  | 'NUMBER'
  | 'TEXTAREA'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'CHECKBOX'
  | 'RADIO'
  | 'FILE'
  | 'DATE';

export interface FormFieldSummary {
  id: string;
  formId: string;
  name: string;
  label: string;
  type: FormFieldType;
  isRequired: boolean;
  position: number;
  config: Record<string, unknown>;
}

export interface FormSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  notifyEmail: string | null;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { submissions: number };
}

export interface FormDetail extends FormSummary {
  fields: FormFieldSummary[];
}

export interface FormSubmissionSummary {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface FormFieldInput {
  name: string;
  label: string;
  type: FormFieldType;
  isRequired?: boolean;
  position?: number;
  config?: Record<string, unknown>;
}

export interface CreateFormBody {
  name: string;
  slug: string;
  description?: string;
  isActive?: boolean;
  notifyEmail?: string;
  fields: FormFieldInput[];
}

export interface UpdateFormBody {
  name?: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
  notifyEmail?: string;
  fields?: FormFieldInput[];
}

export interface SubmitFormBody {
  data: Record<string, unknown>;
  _hp?: string;
}

export interface ListSubmissionsParams {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedSubmissions {
  data: FormSubmissionSummary[];
  total: number;
  page: number;
  limit: number;
}
