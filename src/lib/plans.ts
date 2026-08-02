import type { PlanTier } from '@/types/database';

export interface Plan {
  id: PlanTier;
  name: string;
  price: number;
  priceDisplay: string;
  description: string;
  features: string[];
  razorpayPlanId: string;
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 2499,
    priceDisplay: '₹2,499/mo',
    description: 'Perfect for new D2C brands testing Meta ads',
    features: [
      'Up to 3 active campaigns',
      '10 AI ad variants per campaign',
      'Weekly performance reports',
      'WhatsApp alerts',
    ],
    razorpayPlanId: process.env.RAZORPAY_PLAN_STARTER || 'plan_starter',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 6999,
    priceDisplay: '₹6,999/mo',
    description: 'For scaling brands with multiple product lines',
    features: [
      'Up to 15 active campaigns',
      'Unlimited AI ad variants',
      'Daily performance reports',
      'Auto-pause on high CPA',
      'Priority support',
    ],
    razorpayPlanId: process.env.RAZORPAY_PLAN_GROWTH || 'plan_growth',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 15999,
    priceDisplay: '₹15,999/mo',
    description: 'Enterprise-grade automation for high-volume sellers',
    features: [
      'Unlimited campaigns',
      'Unlimited AI ad variants',
      'Real-time performance dashboard',
      'Advanced auto-pause rules',
      'Dedicated account manager',
      'Custom integrations',
    ],
    razorpayPlanId: process.env.RAZORPAY_PLAN_SCALE || 'plan_scale',
  },
];

export function getPlan(tier: PlanTier): Plan {
  return PLANS.find((p) => p.id === tier) || PLANS[0];
}
