import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy — AdForge',
  description:
    'How AdForge collects, uses, and shares data when you connect Meta (Facebook/Instagram) and run ads.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="4 September 2026">
      <p>
        AdForge (&quot;we&quot;, &quot;us&quot;) is operated by Arham Technology. This Privacy Policy
        explains what information we collect when you use AdForge (including local development and
        production deployments), and when you connect a Meta (Facebook / Instagram) account via
        Facebook Login and the Marketing API.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email address and authentication identifiers from Sign in /
          Sign up (or Demo Mode session markers).
        </li>
        <li>
          <strong>Meta connection data</strong> — after you authorize Facebook Login we may store
          encrypted access tokens, ad account IDs, Page IDs, and related Meta identifiers needed to
          create and manage ads on <em>your</em> ad account.
        </li>
        <li>
          <strong>Campaign &amp; creative data</strong> — brand URLs, product images, ad copy,
          audiences, budgets, and performance metrics you generate or sync through AdForge.
        </li>
        <li>
          <strong>Usage &amp; device data</strong> — basic logs (pages visited, errors, approximate
          IP) needed to operate and secure the service.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide AI creative generation, campaign drafting, launch, and reporting.</li>
        <li>Connect to Meta APIs on your behalf after you grant permission.</li>
        <li>Authenticate sessions, prevent abuse, and improve product reliability.</li>
        <li>Send transactional email (e.g. digests or support replies) when configured.</li>
      </ul>

      <h2>3. Meta / Facebook data</h2>
      <p>
        When you click <strong>Connect with Facebook</strong>, Meta shares data permitted by the
        scopes you approve (for example ads management and Page access). We use that data only to
        operate AdForge features you request. We do not sell Meta user data. Ad spend is billed by
        Meta to the connected ad account — not to AdForge unless separately agreed.
      </p>
      <p>
        Our use of information received from Meta APIs complies with the{' '}
        <a
          href="https://developers.facebook.com/terms/dfc_platform_terms/"
          target="_blank"
          rel="noreferrer"
        >
          Meta Platform Terms
        </a>{' '}
        and applicable Meta developer policies.
      </p>

      <h2>4. Sharing</h2>
      <p>We may share data with:</p>
      <ul>
        <li>Infrastructure providers (hosting, database, email) under contract.</li>
        <li>Meta Platforms, Inc., when you authorize API actions (create campaigns, creatives, etc.).</li>
        <li>Authorities if required by law.</li>
      </ul>
      <p>We do not sell personal information.</p>

      <h2>5. Retention</h2>
      <p>
        We retain account and campaign data while your account is active and for a reasonable period
        afterward for backups, disputes, and legal obligations. You may request deletion (see{' '}
        <a href="/data-deletion">Data deletion</a>).
      </p>

      <h2>6. Security</h2>
      <p>
        Access tokens are stored encrypted at rest where configured. No method of transmission or
        storage is 100% secure; use strong passwords and disconnect Meta when finished testing.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on your location, you may request access, correction, or deletion of personal
        data. Contact{' '}
        <a href="mailto:support@arhamtechnology.com">support@arhamtechnology.com</a>. Meta-specific
        permissions can also be revoked in Facebook → Settings → Apps and websites.
      </p>

      <h2>8. Children</h2>
      <p>AdForge is not directed to children under 16. We do not knowingly collect their data.</p>

      <h2>9. Changes</h2>
      <p>
        We may update this policy. The &quot;Last updated&quot; date above will change when we do.
        Continued use after changes means you accept the updated policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        Arham Technology — AdForge
        <br />
        Email: <a href="mailto:support@arhamtechnology.com">support@arhamtechnology.com</a>
      </p>
    </LegalPage>
  );
}
