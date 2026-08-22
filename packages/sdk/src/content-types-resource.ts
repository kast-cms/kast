import type { KastClient } from './client.js';
import type {
  AddFieldBody,
  ApiListResponse,
  ApiResponse,
  ContentField,
  ContentTypeDetail,
  ContentTypeSummary,
  CreateContentTypeBody,
  LoginResult,
  MfaSetup,
  MfaSetupVerified,
  MfaStatus,
  ReorderFieldsBody,
  SessionSummary,
  TokenPair,
  UpdateContentTypeBody,
  UpdateFieldBody,
} from './types.js';

export class AuthResource {
  constructor(private readonly client: KastClient) {}

  login(email: string, password: string): Promise<ApiResponse<LoginResult>> {
    return this.client.request('/api/v1/auth/login', { method: 'POST', body: { email, password } });
  }

  refresh(refreshToken: string): Promise<ApiResponse<TokenPair>> {
    return this.client.request('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } });
  }

  me(): Promise<unknown> {
    return this.client.request('/api/v1/auth/me');
  }

  /**
   * Returns the URL to redirect the user to for OAuth login.
   * The provider initiates a server-side redirect, so this method
   * constructs the URL rather than following it.
   */
  getOAuthUrl(provider: 'google' | 'github' | 'oidc'): string {
    return `${this.client.getBaseUrl()}/api/v1/auth/oauth/${provider}`;
  }

  mfaStatus(): Promise<ApiResponse<MfaStatus>> {
    return this.client.request('/api/v1/auth/mfa');
  }

  beginMfaSetup(): Promise<ApiResponse<MfaSetup>> {
    return this.client.request('/api/v1/auth/mfa/setup', { method: 'POST' });
  }

  verifyMfaSetup(secret: string, code: string): Promise<ApiResponse<MfaSetupVerified>> {
    return this.client.request('/api/v1/auth/mfa/verify-setup', {
      method: 'POST',
      body: { secret, code },
    });
  }

  completeMfaChallenge(challengeToken: string, code: string): Promise<ApiResponse<TokenPair>> {
    return this.client.request('/api/v1/auth/mfa/challenge', {
      method: 'POST',
      body: { challengeToken, code },
    });
  }

  regenerateRecoveryCodes(code: string): Promise<ApiResponse<{ recoveryCodes: string[] }>> {
    return this.client.request('/api/v1/auth/mfa/recovery-codes', {
      method: 'POST',
      body: { code },
    });
  }

  disableMfa(currentPassword: string, code: string): Promise<ApiResponse<MfaStatus>> {
    return this.client.request('/api/v1/auth/mfa', {
      method: 'DELETE',
      body: { currentPassword, code },
    });
  }

  listSessions(): Promise<ApiResponse<SessionSummary[]>> {
    return this.client.request('/api/v1/auth/sessions');
  }

  revokeSession(id: string): Promise<void> {
    return this.client.request(`/api/v1/auth/sessions/${id}`, { method: 'DELETE' });
  }

  revokeAllSessions(): Promise<ApiResponse<{ revoked: number }>> {
    return this.client.request('/api/v1/auth/sessions', { method: 'DELETE' });
  }

  forgotPassword(email: string): Promise<{ message: string }> {
    return this.client.request('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  }

  resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.client.request('/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
    });
  }
}

export class ContentTypesResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<ApiListResponse<ContentTypeSummary>> {
    return this.client.request('/api/v1/content-types');
  }

  get(name: string): Promise<ApiResponse<ContentTypeDetail>> {
    return this.client.request(`/api/v1/content-types/${name}`);
  }

  create(data: CreateContentTypeBody): Promise<ApiResponse<ContentTypeDetail>> {
    return this.client.request('/api/v1/content-types', { method: 'POST', body: data });
  }

  update(name: string, data: UpdateContentTypeBody): Promise<ApiResponse<ContentTypeDetail>> {
    return this.client.request(`/api/v1/content-types/${name}`, { method: 'PATCH', body: data });
  }

  delete(name: string): Promise<void> {
    return this.client.request(`/api/v1/content-types/${name}`, { method: 'DELETE' });
  }

  addField(name: string, data: AddFieldBody): Promise<ApiResponse<ContentField>> {
    return this.client.request(`/api/v1/content-types/${name}/fields`, {
      method: 'POST',
      body: data,
    });
  }

  updateField(
    name: string,
    fieldName: string,
    data: UpdateFieldBody,
  ): Promise<ApiResponse<ContentField>> {
    return this.client.request(`/api/v1/content-types/${name}/fields/${fieldName}`, {
      method: 'PATCH',
      body: data,
    });
  }

  deleteField(name: string, fieldName: string): Promise<void> {
    return this.client.request(`/api/v1/content-types/${name}/fields/${fieldName}`, {
      method: 'DELETE',
    });
  }

  reorderFields(name: string, data: ReorderFieldsBody): Promise<ApiResponse<ContentTypeDetail>> {
    return this.client.request(`/api/v1/content-types/${name}/fields/reorder`, {
      method: 'PATCH',
      body: data,
    });
  }
}

export class HealthResource {
  constructor(private readonly client: KastClient) {}

  check(): Promise<unknown> {
    return this.client.request('/api/v1/health');
  }
}
