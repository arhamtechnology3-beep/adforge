import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Data Deletion — AdForge',
  description:
    'How to request deletion of AdForge account data and revoke Meta (Facebook) access.',
};

export default function DataDeletionPage() {
  return (
    <LegalPage title="User Data Deletion" updated="4 September 2026">
      <p>
        Meta requires apps that use Facebook Login to provide a way for users to request deletion of
        their data. This page explains how to remove AdForge data and disconnect Meta.
      </p>

      <h2>1. Disconnect Meta (Facebook / Instagram)</h2>
      <ol className="list-decimal pl-5">
        <li>
          Open Facebook → <strong>Settings &amp; privacy</strong> → <strong>Settings</strong> →{' '}
          <strong>Apps and websites</strong>.
        </li>
        <li>Find <strong>AdForge</strong> (or the app name linked to App ID used for Connect).</li>
        <li>Select <strong>Remove</strong> to revoke access tokens.</li>
      </ol>
      <p className="mt-3">
        You can also disconnect from inside AdForge when signed in (Campaigns / settings flows that
        clear the stored Meta connection).
      </p>

      <h2>2. Request deletion of AdForge-stored data</h2>
      <p>Email us from the address associated with your AdForge account:</p>
      <p>
        <a href="mailto:support@arhamtechnology.com?subject=AdForge%20Data%20Deletion%20Request">
          support@arhamtechnology.com
        </a>
      </p>
      <p>Include:</p>
      <ul>
        <li>Subject line: <strong>AdForge Data Deletion Request</strong></li>
        <li>Your AdForge login email</li>
        <li>Optional: Meta user ID or ad account ID if known</li>
      </ul>
      <p>
        We will delete or anonymize account profile data, stored Meta tokens, campaign drafts, and
        generated creatives associated with your user within <strong>30 days</strong>, except where
        we must retain records for legal, security, or billing reasons.
      </p>

      <h2>3. Demo Mode</h2>
      <p>
        Demo sessions may store drafts on the local server under temporary files. Clearing the demo
        session cookie and asking support to purge demo files for your machine/environment removes
        that data. Regenerating a new demo session starts fresh.
      </p>

      <h2>4. Confirmation</h2>
      <p>
        After we process your request, we will reply by email confirming deletion (or explaining any
        data we are legally required to keep and for how long).
      </p>

      <h2>5. Related</h2>
      <ul>
        <li>
          <a href="/privacy">Privacy Policy</a>
        </li>
        <li>
          <a href="/terms">Terms of Service</a>
        </li>
      </ul>
    </LegalPage>
  );
}
