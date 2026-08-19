export type SubscriptionStatus = 'active' | 'paused' | 'expired';

export type Skill = {
  id: string;
  title: string;
  body: string;
};

export type TenantSmtp = {
  host: string;
  port: number;
  user: string;
  /** Stored on disk; never returned to the browser in full after save. */
  pass: string;
  from?: string;
  replyTo?: string;
};

export type Tenant = {
  id: string;
  slug: string;
  companyName: string;
  assistantName: string;
  website?: string;
  /** Data URL or site-relative path. */
  logoUrl?: string;
  status: SubscriptionStatus;
  /** Manual billing. Empty means no expiry (honour `status` only). */
  paidUntil?: string;
  notes?: string;
  skills: Skill[];
  /** Extra spoken instructions, merged into the voice overlay. */
  extraInstructions?: string;
  smtp?: TenantSmtp;
  createdAt: string;
  updatedAt: string;
};

export type TenantAdmin = {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
};

export type DashboardSession = {
  role: 'super' | 'admin';
  tenantId?: string;
  adminId?: string;
  email?: string;
};

export type PublicTenantBrand = {
  slug: string;
  companyName: string;
  assistantName: string;
  website?: string;
  logoUrl?: string;
  skills: Skill[];
  active: boolean;
  pausedMessage?: string;
};
