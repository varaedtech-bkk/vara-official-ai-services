import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Skill, Tenant, TenantAdmin } from './types';
import { hashPassword } from './crypto';

const DATA_DIR = process.env.LEADS_DIR || join(process.cwd(), 'data');
const TENANTS_FILE = join(DATA_DIR, 'tenants.json');
const ADMINS_FILE = join(DATA_DIR, 'admins.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  ensureDir();
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'ai-services',
    title: 'Our AI services',
    body: 'Answer Engine Optimization, voice assistants, chatbots, automation, analytics and custom private AI models.',
  },
  {
    id: 'platforms',
    title: 'What we have already built',
    body: 'Four flagship platforms: a real-time AI engine, Estimaro, RedLine, and private AI models trained on your content.',
  },
  {
    id: 'universities',
    title: 'University partnerships',
    body: 'Nine campus ideas, AI workshops and faculty training, plus a pilot-first path.',
  },
];

function defaultTenant(): Tenant {
  const now = new Date().toISOString();
  return {
    id: 'vara',
    slug: 'vara',
    companyName: 'VARA EdTech',
    assistantName: 'Sunny',
    website: 'https://varaedtech.com',
    logoUrl: '/brand/vara-logo.png',
    status: 'active',
    notes: 'Platform owner tenant. Manual subscription — always active.',
    skills: DEFAULT_SKILLS,
    createdAt: now,
    updatedAt: now,
  };
}

function seedTenants(list: Tenant[]): Tenant[] {
  if (list.some((t) => t.slug === 'vara' || t.id === 'vara')) return list;
  return [defaultTenant(), ...list];
}

export function readTenants(): Tenant[] {
  const seeded = seedTenants(readJson<Tenant[]>(TENANTS_FILE, []));
  if (!existsSync(TENANTS_FILE)) writeTenants(seeded);
  return seeded;
}

export function writeTenants(tenants: Tenant[]) {
  writeJson(TENANTS_FILE, tenants);
}

export function getTenant(idOrSlug: string): Tenant | undefined {
  const key = idOrSlug.trim().toLowerCase();
  return readTenants().find((t) => t.id === idOrSlug || t.slug.toLowerCase() === key);
}

export function isTenantActive(tenant: Tenant): boolean {
  if (tenant.status !== 'active') return false;
  if (!tenant.paidUntil) return true;
  return Date.parse(tenant.paidUntil) >= Date.now();
}

export function upsertTenant(input: Partial<Tenant> & { companyName: string; slug: string }): Tenant {
  const tenants = readTenants();
  const slug = slugify(input.slug);
  const existing = input.id
    ? tenants.find((t) => t.id === input.id)
    : tenants.find((t) => t.slug === slug);

  if (!existing && tenants.some((t) => t.slug === slug)) {
    throw new Error('That workspace URL is already taken.');
  }

  const now = new Date().toISOString();
  const tenant: Tenant = {
    id: existing?.id ?? randomUUID(),
    slug,
    companyName: input.companyName.trim(),
    assistantName: (input.assistantName ?? existing?.assistantName ?? 'Sunny').trim() || 'Sunny',
    website: input.website ?? existing?.website,
    logoUrl: input.logoUrl ?? existing?.logoUrl,
    status: input.status ?? existing?.status ?? 'active',
    paidUntil: input.paidUntil ?? existing?.paidUntil,
    notes: input.notes ?? existing?.notes,
    skills: input.skills ?? existing?.skills ?? [],
    extraInstructions: input.extraInstructions ?? existing?.extraInstructions,
    smtp: Object.prototype.hasOwnProperty.call(input, 'smtp') ? input.smtp : existing?.smtp,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const next = existing
    ? tenants.map((t) => (t.id === tenant.id ? tenant : t))
    : [...tenants, tenant];
  writeTenants(next);
  return tenant;
}

export function readAdmins(): TenantAdmin[] {
  return readJson<TenantAdmin[]>(ADMINS_FILE, []);
}

export function writeAdmins(admins: TenantAdmin[]) {
  writeJson(ADMINS_FILE, admins);
}

export function findAdminByEmail(email: string): TenantAdmin | undefined {
  const key = email.trim().toLowerCase();
  return readAdmins().find((a) => a.email === key);
}

export function createAdmin(input: {
  email: string;
  name: string;
  tenantId: string;
  password: string;
}): TenantAdmin {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('A valid email is required.');
  if (findAdminByEmail(email)) throw new Error('An admin with that email already exists.');
  if (!getTenant(input.tenantId)) throw new Error('Tenant not found.');
  if (!input.password || input.password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const admin: TenantAdmin = {
    id: randomUUID(),
    email,
    name: input.name.trim() || email,
    tenantId: input.tenantId,
    passwordHash: hashPassword(input.password),
    active: true,
    createdAt: new Date().toISOString(),
  };
  writeAdmins([...readAdmins(), admin]);
  return admin;
}

export function setAdminActive(id: string, active: boolean): TenantAdmin | undefined {
  const admins = readAdmins();
  const found = admins.find((a) => a.id === id);
  if (!found) return undefined;
  found.active = active;
  writeAdmins(admins);
  return found;
}

export function resetAdminPassword(id: string, password: string): TenantAdmin | undefined {
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  const admins = readAdmins();
  const found = admins.find((a) => a.id === id);
  if (!found) return undefined;
  found.passwordHash = hashPassword(password);
  writeAdmins(admins);
  return found;
}

export function publicAdmin(admin: TenantAdmin) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    tenantId: admin.tenantId,
    active: admin.active,
    createdAt: admin.createdAt,
  };
}

export function publicTenant(tenant: Tenant) {
  return {
    ...tenant,
    smtp: tenant.smtp
      ? {
          host: tenant.smtp.host,
          port: tenant.smtp.port,
          user: tenant.smtp.user,
          from: tenant.smtp.from,
          replyTo: tenant.smtp.replyTo,
          passSet: Boolean(tenant.smtp.pass),
        }
      : undefined,
  };
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  if (!slug) throw new Error('Workspace URL cannot be empty.');
  return slug;
}
