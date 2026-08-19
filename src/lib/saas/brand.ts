import type { Tenant } from './types';
import { isTenantActive } from './store';

export function clientSkillsBlock(tenant: Tenant): string {
  if (!tenant.skills.length) return '';
  return tenant.skills
    .map((s) => `- ${s.title}: ${s.body}`)
    .join('\n');
}

export function voiceVariableValues(tenant: Tenant) {
  return {
    assistantName: tenant.assistantName || 'Sara',
    companyName: tenant.companyName || 'VARA EdTech',
    clientSkills: clientSkillsBlock(tenant) || 'Use the platform knowledge you already have.',
    extraInstructions: tenant.extraInstructions?.trim() || '',
  };
}

export function voiceFirstMessage(tenant: Tenant, lang: 'en' | 'th' = 'en'): string {
  const name = tenant.assistantName || 'Sara';
  const company = tenant.companyName || 'VARA EdTech';
  if (lang === 'th') {
    return `สวัสดีค่ะ ดิฉัน${name} จาก ${company} ค่ะ ให้ดิฉันช่วยอะไรดีคะ`;
  }
  return `Hi, this is ${name} from ${company}. How may I help you?`;
}

export function publicBrand(tenant: Tenant) {
  const active = isTenantActive(tenant);
  return {
    slug: tenant.slug,
    companyName: tenant.companyName,
    assistantName: tenant.assistantName,
    website: tenant.website,
    logoUrl: tenant.logoUrl || '/brand/vara-logo.png',
    skills: tenant.skills,
    extraInstructions: tenant.extraInstructions,
    active,
    pausedMessage: active
      ? undefined
      : `${tenant.companyName}'s assistant is paused. Ask VARA EdTech to renew the workspace.`,
  };
}
