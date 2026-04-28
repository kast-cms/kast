export type StorageProvider = 'local' | 's3' | 'r2' | 'minio';
export type FrontendStarter = 'none' | 'blog' | 'docs';
export type DeployTarget = 'none' | 'railway' | 'render' | 'vercel';
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

export interface ProjectOptions {
  projectName: string;
  packageManager: PackageManager;
  apiPort: number;
  i18n: boolean;
  defaultLocale: string;
  extraLocales: string[];
  storageProvider: StorageProvider;
  plugins: string[];
  frontendStarter: FrontendStarter;
  deployTarget: DeployTarget;
}
