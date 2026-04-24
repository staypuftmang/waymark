import type { Metadata } from "next";
import StaticPageLayout from "@/app/components/StaticPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Waymark",
  description: "The terms that govern your use of Waymark.",
};

export default function TermsPage() {
  return (
    <StaticPageLayout title="Terms of Service" lastUpdated="April 19, 2026">
      <h2>The service</h2>
      <ul>
        <li>
          Waymark is a web application that helps users create travel journals from their photos using AI-powered
          writing assistance
        </li>
        <li>
          The service is provided &quot;as is&quot; — we strive for reliability but don&apos;t guarantee uninterrupted
          availability
        </li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information when creating an account</li>
        <li>You are responsible for maintaining the security of your account</li>
        <li>One person per account — accounts are not transferable</li>
      </ul>

      <h2>Your content</h2>
      <ul>
        <li>You own everything you create on Waymark — your photos, your text, your journals</li>
        <li>We don&apos;t claim any ownership or intellectual property rights over your content</li>
        <li>
          By using the service, you grant Waymark a limited license to store, process, and display your content solely
          for the purpose of providing the service
        </li>
        <li>If you make a journal public via a sharing link, you are granting anyone with the link the ability to view it</li>
      </ul>

      <h2>AI-generated content</h2>
      <ul>
        <li>AI-generated text (captions, notes, paragraphs) is created for you based on your photos and input</li>
        <li>You may use, edit, and publish AI-generated content without restriction</li>
        <li>
          AI-generated content may not be perfectly accurate — you are responsible for reviewing and editing it before
          sharing
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don&apos;t use Waymark to create content that is illegal, harmful, abusive, or violates others&apos; rights</li>
        <li>Don&apos;t attempt to reverse-engineer, hack, or disrupt the service</li>
        <li>Don&apos;t use automated tools to scrape or overload the service</li>
        <li>We reserve the right to suspend accounts that violate these terms</li>
      </ul>

      <h2>Intellectual property</h2>
      <ul>
        <li>The Waymark brand, design, and software are owned by Waymark</li>
        <li>You may not use the Waymark name, logo, or branding without permission</li>
        <li>
          The &quot;Made with Waymark&quot; footer on exported journals is part of the free service and should not be
          removed
        </li>
      </ul>

      <h2>Limitation of liability</h2>
      <ul>
        <li>Waymark is not liable for any loss of data, content, or damages arising from use of the service</li>
        <li>
          Our total liability is limited to the amount you&apos;ve paid for the service in the past 12 months (if
          anything)
        </li>
      </ul>

      <h2>Free and paid tiers</h2>
      <ul>
        <li>Certain features may be available only to paid subscribers</li>
        <li>We reserve the right to modify pricing and feature availability with reasonable notice</li>
        <li>Free tier usage may be subject to rate limits</li>
      </ul>

      <h2>Termination</h2>
      <ul>
        <li>You can delete your account at any time</li>
        <li>We may suspend or terminate accounts that violate these terms</li>
        <li>Upon termination, your content will be deleted within 30 days</li>
      </ul>

      <h2>Changes to these terms</h2>
      <ul>
        <li>We may update these terms from time to time</li>
        <li>Continued use of the service after changes constitutes acceptance</li>
      </ul>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of California.</p>

      <h2>Contact</h2>
      <p>
        For questions about these terms: <a href="mailto:support@mywaymarks.com">support@mywaymarks.com</a>
      </p>
    </StaticPageLayout>
  );
}
