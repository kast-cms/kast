export type TextDirection = 'LTR' | 'RTL';

export interface LocaleSummary {
  code: string;
  name: string;
  nativeName: string;
  direction: TextDirection;
  isDefault: boolean;
  isActive: boolean;
  fallbackCode: string | null;
  createdAt: string;
}

export interface CreateLocaleBody {
  code: string;
  name: string;
  nativeName: string;
  direction?: TextDirection;
  fallbackCode?: string;
}

export interface UpdateLocaleBody {
  name?: string;
  nativeName?: string;
  direction?: TextDirection;
  isActive?: boolean;
  fallbackCode?: string;
}
