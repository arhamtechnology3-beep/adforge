import Razorpay from 'razorpay';
import type { PlanTier } from '@/types/database';
import { getPlan } from './plans';

let razorpayInstance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return razorpayInstance;
}

export async function createSubscription(
  planTier: PlanTier,
  customerEmail: string,
  customerName: string
) {
  const plan = getPlan(planTier);
  const razorpay = getRazorpay();

  const subscription = await razorpay.subscriptions.create({
    plan_id: plan.razorpayPlanId,
    total_count: 12,
    quantity: 1,
    customer_notify: 1,
    notes: {
      plan_tier: planTier,
      email: customerEmail,
      name: customerName,
    },
  });

  return subscription;
}

import crypto from 'crypto';

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  return expected === signature;
}
