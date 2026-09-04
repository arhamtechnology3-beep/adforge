import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service — AdForge',
  description: 'Terms governing use of the AdForge Meta ads automation platform.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="4 September 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to AdForge, operated by Arham
        Technology. By creating an account, starting a trial, or using Demo Mode, you agree to these
        Terms.
      </p>

      <h2>1. The service</h2>
      <p>
        AdForge helps brands draft Meta (Facebook / Instagram) ads, creatives, and campaigns, and
        optionally publish them to ad accounts you connect. Features may change during beta or
        trial.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must provide accurate signup information and keep credentials secure.</li>
        <li>
          Demo Mode is for evaluation only and may store drafts locally without a full production
          account.
        </li>
        <li>You are responsible for activity under your account.</li>
      </ul>

      <h2>3. Meta connection &amp; advertising</h2>
      <ul>
        <li>
          Connecting Meta requires your authorization. You must have rights to the ad accounts and
          Pages you connect.
        </li>
        <li>
          Ads you launch must comply with Meta Advertising Policies and applicable law (including
          India consumer and advertising rules where relevant).
        </li>
        <li>
          Ad spend is charged by Meta to the connected ad account. AdForge does not pay your media
          spend unless separately contracted.
        </li>
        <li>
          Campaigns are typically created <strong>PAUSED</strong> until you explicitly confirm
          launch. You remain responsible for final review before going live.
        </li>
      </ul>

      <h2>4. AI-generated content</h2>
      <p>
        Creatives and copy may be generated or assisted by AI. You must review all content for
        accuracy, trademarks, and policy compliance before publishing. AdForge does not guarantee
        performance outcomes (ROAS, CPA, etc.).
      </p>

      <h2>5. Acceptable use</h2>
      <p>You may not use AdForge to:</p>
      <ul>
        <li>Violate Meta policies, platform terms, or law.</li>
        <li>Infringe IP or privacy rights of others.</li>
        <li>Attempt unauthorized access, scrape, or disrupt the service.</li>
        <li>Misrepresent affiliation with Meta or Arham Technology.</li>
      </ul>

      <h2>6. Fees &amp; trial</h2>
      <p>
        Free trials or plans are described in-product. Paid subscriptions (if enabled) renew until
        cancelled per the billing provider&apos;s terms. Media spend is separate from AdForge
        software fees.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        AdForge software, branding, and UI remain ours. You retain rights to your brand assets and
        content you upload. You grant us a limited license to process that content to provide the
        service.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE OR NON-INFRINGEMENT. Meta API
        availability and policy enforcement are outside our control.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Arham Technology is not liable for indirect,
        incidental, or consequential damages, or for ad spend, rejected ads, or account suspensions
        by Meta. Our aggregate liability for claims relating to the service is limited to fees you
        paid us for AdForge software in the three months before the claim (excluding media spend).
      </p>

      <h2>10. Termination</h2>
      <p>
        You may stop using AdForge at any time and may request data deletion via{' '}
        <a href="/data-deletion">/data-deletion</a>. We may suspend access for policy violations or
        risk to the platform.
      </p>

      <h2>11. Privacy</h2>
      <p>
        Personal data is handled as described in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>12. Contact</h2>
      <p>
        Arham Technology — AdForge
        <br />
        Email: <a href="mailto:support@arhamtechnology.com">support@arhamtechnology.com</a>
      </p>
    </LegalPage>
  );
}
