import type { GeneratedAd } from '@/types/database';
import {
  type CampaignLaunchInput,
  getObjectiveConfig,
  META_CTA_OPTIONS,
} from '@/lib/meta-campaign';
import { resolvePublicCreativeImageUrl } from '@/lib/meta';

export type ValidationItem = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
};

export type CampaignValidationResult = {
  valid: boolean;
  can_launch: boolean;
  items: ValidationItem[];
  errors: string[];
  warnings: string[];
};

const VALID_CTAS = new Set(META_CTA_OPTIONS.map((c) => c.value));

export function validateCampaignLaunch(opts: {
  input: Partial<CampaignLaunchInput>;
  ads?: Pick<GeneratedAd, 'id' | 'copy_text' | 'headline' | 'image_url' | 'status'>[];
  meta_connected?: boolean;
  has_pixel?: boolean;
  page_id?: string | null;
}): CampaignValidationResult {
  const items: ValidationItem[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const input = opts.input;
  const ads = (opts.ads || []).filter((a) => a.status === 'approved');

  // Meta connection
  if (opts.meta_connected) {
    items.push({
      id: 'meta_connected',
      label: 'Meta ad account connected',
      status: 'pass',
      message: 'OAuth token is valid',
    });
  } else {
    items.push({
      id: 'meta_connected',
      label: 'Meta ad account connected',
      status: 'warn',
      message: 'Not connected — campaign will save as local draft only',
    });
    warnings.push('Connect Meta to publish live on Facebook & Instagram');
  }

  // Page ID
  if (opts.page_id && opts.page_id !== 'me') {
    items.push({
      id: 'page_id',
      label: 'Facebook Page linked',
      status: 'pass',
      message: `Page ID: ${opts.page_id}`,
    });
  } else if (opts.meta_connected) {
    items.push({
      id: 'page_id',
      label: 'Facebook Page linked',
      status: 'warn',
      message:
        'No Page on this Meta login yet — reconnect Facebook (we auto-pick your Page) or set META_PAGE_ID',
    });
    warnings.push('Facebook Page ID not linked yet');
  }

  // Campaign name
  if (input.name?.trim()) {
    items.push({
      id: 'name',
      label: 'Campaign name',
      status: input.name.length > 400 ? 'fail' : 'pass',
      message:
        input.name.length > 400
          ? 'Name exceeds 400 characters'
          : `"${input.name.trim().slice(0, 50)}${input.name.length > 50 ? '…' : ''}"`,
    });
    if (input.name.length > 400) errors.push('Campaign name must be ≤ 400 characters');
  } else {
    items.push({
      id: 'name',
      label: 'Campaign name',
      status: 'fail',
      message: 'Required',
    });
    errors.push('Campaign name is required');
  }

  // Objective
  const objConfig = getObjectiveConfig(input.objective || '');
  if (input.objective) {
    items.push({
      id: 'objective',
      label: 'Campaign objective',
      status: 'pass',
      message: objConfig.label,
    });
  } else {
    items.push({
      id: 'objective',
      label: 'Campaign objective',
      status: 'fail',
      message: 'Select an objective',
    });
    errors.push('Objective is required');
  }

  // Pixel for sales
  if (input.objective === 'OUTCOME_SALES') {
    if (opts.has_pixel) {
      items.push({
        id: 'pixel',
        label: 'Meta Pixel installed',
        status: 'pass',
        message: 'Conversion tracking ready',
      });
    } else {
      items.push({
        id: 'pixel',
        label: 'Meta Pixel installed',
        status: 'warn',
        message: 'Recommended for Sales objective — set META_PIXEL_ID',
      });
      warnings.push('Meta Pixel recommended for Sales campaigns');
    }
  }

  // Budget
  const budget = Number(input.budget);
  const budgetType = input.budget_type || 'daily';
  if (budget >= 100) {
    items.push({
      id: 'budget',
      label: `${budgetType === 'lifetime' ? 'Lifetime' : 'Daily'} budget`,
      status: 'pass',
      message: `₹${budget.toLocaleString('en-IN')}${budgetType === 'daily' ? '/day' : ' total'}`,
    });
  } else {
    items.push({
      id: 'budget',
      label: 'Budget',
      status: 'fail',
      message: 'Minimum ₹100 required',
    });
    errors.push('Minimum budget is ₹100');
  }

  // Destination URL
  const url = input.website_url?.trim() || '';
  const urlValid = /^https:\/\/.+/i.test(url);
  if (urlValid) {
    items.push({
      id: 'url',
      label: 'Destination URL',
      status: 'pass',
      message: url.length > 50 ? `${url.slice(0, 50)}…` : url,
    });
  } else {
    items.push({
      id: 'url',
      label: 'Destination URL',
      status: 'fail',
      message: 'Must be a valid HTTPS URL',
    });
    errors.push('Destination URL must start with https://');
  }

  // CTA
  const cta = (input.cta || input.audience?.cta || 'SHOP_NOW').toUpperCase();
  if (VALID_CTAS.has(cta as (typeof META_CTA_OPTIONS)[number]['value'])) {
    items.push({
      id: 'cta',
      label: 'Call to action',
      status: 'pass',
      message: cta.replace(/_/g, ' '),
    });
  } else {
    items.push({
      id: 'cta',
      label: 'Call to action',
      status: 'fail',
      message: `Invalid CTA: ${cta}`,
    });
    errors.push(`Invalid CTA button: ${cta}`);
  }

  // Audience age
  const ageMin = Number(input.audience?.age_min) || 18;
  const ageMax = Number(input.audience?.age_max) || 65;
  if (ageMin <= ageMax && ageMin >= 13 && ageMax <= 65) {
    items.push({
      id: 'age',
      label: 'Age range',
      status: 'pass',
      message: `${ageMin}–${ageMax}`,
    });
  } else {
    items.push({
      id: 'age',
      label: 'Age range',
      status: 'fail',
      message: 'Age must be 13–65 with min ≤ max',
    });
    errors.push('Invalid age range');
  }

  // Schedule
  if (input.audience?.end_date && input.audience?.start_date) {
    const start = new Date(input.audience.start_date);
    const end = new Date(input.audience.end_date);
    if (end >= start) {
      items.push({
        id: 'schedule',
        label: 'Schedule',
        status: 'pass',
        message: `${input.audience.start_date} → ${input.audience.end_date}`,
      });
    } else {
      items.push({
        id: 'schedule',
        label: 'Schedule',
        status: 'fail',
        message: 'End date must be after start date',
      });
      errors.push('End date must be after start date');
    }
  } else {
    items.push({
      id: 'schedule',
      label: 'Schedule',
      status: 'pass',
      message: 'Runs continuously from launch',
    });
  }

  // Creatives
  const selectedIds = input.ad_ids || [];
  const selectedAds = ads.filter((a) => selectedIds.includes(a.id));

  if (selectedAds.length === 0) {
    items.push({
      id: 'creatives',
      label: 'Approved creatives',
      status: 'fail',
      message: 'Select at least one approved ad',
    });
    errors.push('Select at least one approved creative');
  } else {
    items.push({
      id: 'creatives',
      label: 'Approved creatives',
      status: 'pass',
      message: `${selectedAds.length} ad${selectedAds.length > 1 ? 's' : ''} selected`,
    });

    for (const ad of selectedAds) {
      const headline = ad.headline || '';
      const copy = ad.copy_text || '';

      if (headline.length > 40) {
        items.push({
          id: `headline_${ad.id}`,
          label: `Headline (variant)`,
          status: 'fail',
          message: `${headline.length}/40 chars — too long`,
        });
        errors.push(`Headline exceeds 40 characters`);
      }
      if (copy.length > 2200) {
        items.push({
          id: `copy_${ad.id}`,
          label: `Primary text (variant)`,
          status: 'fail',
          message: `${copy.length}/2200 chars — too long`,
        });
        errors.push(`Primary text exceeds 2200 characters`);
      }
      if (!ad.image_url) {
        items.push({
          id: `image_${ad.id}`,
          label: `Creative image`,
          status: 'fail',
          message: 'Image URL missing',
        });
        errors.push('Creative image URL is required');
      } else {
        const publicImage = resolvePublicCreativeImageUrl(ad.image_url);
        if (!publicImage || !/^https:\/\//i.test(publicImage)) {
          items.push({
            id: `image_${ad.id}`,
            label: `Creative image`,
            status: 'warn',
            message:
              'Image must resolve to a public HTTPS URL (Shopify/CDN). Re-generate or pick another creative.',
          });
          warnings.push('Ensure creative images are publicly accessible via HTTPS');
        }
      }
    }
  }

  const valid = errors.length === 0;
  const can_launch = valid && selectedAds.length > 0;

  return { valid, can_launch, items, errors, warnings };
}
