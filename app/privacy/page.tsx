import type { Metadata } from "next";
import StaticPageLayout from "@/app/components/StaticPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Waymark",
  description: "How Waymark collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <StaticPageLayout title="Privacy Policy" lastUpdated="April 19, 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Account information: email address and name when you create an account</li>
        <li>Journal content: trip titles, dates, captions, notes, and paragraphs you write or generate</li>
        <li>
          Photos: uploaded photos are sent to our AI service providers for writing assistance and may be stored on our
          servers if you save your journal
        </li>
        <li>
          Usage data: anonymous page views and interactions via cookie-free analytics (no personal tracking, no cookies,
          visitor data is hashed and resets daily)
        </li>
      </ul>

      <h2>How we use your data</h2>
      <ul>
        <li>To provide the Waymark service — generating AI-written journal content, saving your journals, and enabling sharing</li>
        <li>To improve the product — anonymous usage analytics help us understand which features are used</li>
        <li>
          To communicate with you — service updates and new feature announcements if you&apos;ve signed up (you can
          unsubscribe anytime)
        </li>
      </ul>

      <h2>Third-party services</h2>
      <ul>
        <li>
          AI service providers — your photos and text are sent to AI providers for content generation. Photos are
          processed in real-time and are not stored by these providers beyond the duration of the request
        </li>
        <li>
          Authentication providers — if you create an account, your email and login credentials are managed by our
          authentication provider
        </li>
        <li>
          Cloud hosting and storage — your saved journals and photos are stored securely with our cloud infrastructure
          providers
        </li>
        <li>
          Analytics — we use cookie-free, privacy-friendly analytics that do not track individual users across sessions
          or websites
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We never sell your data to anyone</li>
        <li>We never use your photos or content to train AI models</li>
        <li>We don&apos;t use cookies or track you across websites</li>
        <li>We don&apos;t share your personal information with advertisers</li>
      </ul>

      <h2>Your photos</h2>
      <ul>
        <li>
          When you use Waymark without an account, your photos stay in your browser&apos;s memory and are never uploaded
          to our servers (except temporarily to our AI provider for writing assistance)
        </li>
        <li>
          When you save a journal with an account, your photos are stored securely on our servers so you can access them
          across devices
        </li>
        <li>You can delete your journals and photos at any time</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li>Access: you can view all data associated with your account</li>
        <li>Delete: you can delete your account and all associated data at any time</li>
        <li>Export: you can download your journals as PDF or image files</li>
        <li>Portability: your content belongs to you — we don&apos;t claim ownership</li>
      </ul>

      <h2>Data retention</h2>
      <ul>
        <li>Active accounts: data retained as long as your account exists</li>
        <li>Deleted accounts: all data permanently removed within 30 days</li>
        <li>Anonymous usage (no account): journal data exists only in your browser and is never stored on our servers</li>
      </ul>

      <h2>Children&apos;s privacy</h2>
      <p>
        Waymark is not directed at children under 13. We do not knowingly collect personal information from children
        under 13.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. We&apos;ll notify registered users of significant changes via email.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions: <a href="mailto:support@mywaymarks.com">support@mywaymarks.com</a>
      </p>
    </StaticPageLayout>
  );
}
