/* ── Content stats ───────────────────────────────────────────── */

export interface DashboardContentByStatus {
  draft: number;
  published: number;
  scheduled: number;
  archived: number;
}

export interface DashboardContentByType {
  typeSlug: string;
  count: number;
}

export interface DashboardContentStats {
  total: number;
  byStatus: DashboardContentByStatus;
  byType: DashboardContentByType[];
}

/* ── Media stats ─────────────────────────────────────────────── */

export interface DashboardMediaByMimeGroup {
  image: number;
  video: number;
  document: number;
  other: number;
}

export interface DashboardMediaStats {
  total: number;
  totalSizeMb: number;
  byMimeGroup: DashboardMediaByMimeGroup;
}

/* ── SEO stats ───────────────────────────────────────────────── */

export interface DashboardSeoScoreDistribution {
  below50: number;
  between50and74: number;
  above74: number;
}

export interface DashboardSeoStats {
  averageScore: number;
  scoreDistribution: DashboardSeoScoreDistribution;
}

/* ── Form stats ──────────────────────────────────────────────── */

export interface DashboardFormStats {
  total: number;
  submissionsToday: number;
  submissionsThisWeek: number;
}

/* ── User stats ──────────────────────────────────────────────── */

export interface DashboardUserStats {
  total: number;
  active: number;
  invited: number;
}

/* ── Dashboard stats (full) ──────────────────────────────────── */

export interface DashboardStats {
  contentEntries: DashboardContentStats;
  media: DashboardMediaStats;
  seo: DashboardSeoStats;
  forms: DashboardFormStats;
  users: DashboardUserStats;
}

/* ── Activity feed ───────────────────────────────────────────── */

export interface DashboardActivityUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface DashboardActivityEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  agentName: string | null;
  ipAddress: string | null;
  isDryRun: boolean;
  createdAt: string;
  user: DashboardActivityUser | null;
}

/* ── Queue health ────────────────────────────────────────────── */

export interface DashboardQueueHealth {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
