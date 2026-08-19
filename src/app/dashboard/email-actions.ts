'use server';

import { handleDashboardSendEmail, type SendEmailInput } from '@/lib/dashboard/sendEmail';

export async function previewFollowUpEmail(input: SendEmailInput) {
  return handleDashboardSendEmail({ ...input, preview: true });
}

export async function sendFollowUpEmailNow(input: SendEmailInput) {
  return handleDashboardSendEmail({ ...input, preview: false });
}
