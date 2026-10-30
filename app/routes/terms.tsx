import { createFileRoute } from "@tanstack/react-router";
import { edgeCacheHeaders } from "@/lib/cache/edge-cache";
import type { ReactNode } from "react";
import { LegalPage } from "@/components/legal/LegalPage";
import { siteConfig } from "@/lib/config/site";
import { generateWebPageJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { publicPageHead } from "@/lib/seo/page-metadata";

const termsTitle = `Terms of Service - ${siteConfig.fullName}`;

const termsDescription = `Terms of Service for ${siteConfig.fullName}. Read our terms and conditions for using the service.`;

export const Route = createFileRoute("/terms")({
  head: () =>
    publicPageHead({
      title: "Terms of Service",
      ogTitle: termsTitle,
      description: termsDescription,
      path: "/terms",
    }),
  headers: () => edgeCacheHeaders(86400),
  component: TermsOfServicePage,
});

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: "Service Description",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          {siteConfig.fullName} (&quot;Service&quot;) provides a platform to convert PDF resumes
          into hosted web portfolios. By using our Service, you agree to these Terms. The Service
          allows users to upload PDF documents, which are then processed using artificial
          intelligence to extract structured information and generate a shareable web page.
        </p>
      </>
    ),
  },
  {
    title: "Eligibility",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          You must be at least 13 years old to use this Service. By using the Service, you represent
          that you meet this requirement. If you are under 18, you represent that you have obtained
          parental or guardian consent to use the Service.
        </p>
      </>
    ),
  },
  {
    title: "Account Responsibilities",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed mb-4">
          When you create an account with us, you agree to the following:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>You are responsible for maintaining the security of your account credentials</li>
          <li>You are responsible for all activities that occur under your account</li>
          <li>You must provide accurate information when creating your account</li>
          <li>You must not share your account with others</li>
          <li>You must notify us immediately of any unauthorized use of your account</li>
        </ul>
      </>
    ),
  },
  {
    title: "Acceptable Use",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed mb-4">You agree NOT to:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>Upload content that violates any laws or regulations</li>
          <li>Upload content that infringes on intellectual property rights</li>
          <li>Use the Service for harassment, spam, or impersonation</li>
          <li>Attempt to gain unauthorized access to the Service or its systems</li>
          <li>Use automated tools to scrape or abuse the Service</li>
          <li>Upload malicious files, viruses, or harmful code</li>
          <li>Interfere with or disrupt the integrity or performance of the Service</li>
          <li>Use the Service to distribute unsolicited commercial communications</li>
        </ul>
      </>
    ),
  },
  {
    title: "Content Ownership",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed mb-4">Your content remains yours:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>
            You retain all ownership rights to your resume content and any information you upload
          </li>
          <li>
            By uploading content, you grant us a limited, non-exclusive license to host, display,
            and process your content solely as needed to provide the Service
          </li>
          <li>
            You may delete your content at any time through the account deletion feature in Settings
          </li>
          <li>We do not claim any ownership over your content</li>
        </ul>
      </>
    ),
  },
  {
    title: "AI Processing",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          After you sign in, resume content is sent to a configured AI model through OpenRouter and
          Cloudflare AI Gateway to extract your name, contact details, work experience, education
          and skills. The model and serving provider can change with our configuration; this is not
          exclusively an OpenAI service. By using the Service, you consent to this processing by the
          providers described in our Privacy Policy. The AI may make extraction errors; review and
          edit the result before publishing.
        </p>
      </>
    ),
  },
  {
    title: "Limitation of Liability",
    body: (
      <>
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
          <p className="text-foreground leading-relaxed font-medium">
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTY
            OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          We are not liable for any damages arising from your use of the Service, including but not
          limited to: loss of data, business interruption, loss of profits, or any indirect,
          incidental, special, consequential, or punitive damages. Our total liability shall not
          exceed the amount you paid us in the twelve (12) months preceding the claim.
        </p>
      </>
    ),
  },
  {
    title: "Termination",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed mb-4">Regarding account termination:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>You may delete your account at any time through the Settings page</li>
          <li>
            We reserve the right to suspend or terminate accounts that violate these Terms without
            prior notice
          </li>
          <li>
            We may terminate or suspend access to the Service immediately, without prior notice or
            liability, for any reason
          </li>
          <li>
            Account deletion removes your profile, uploaded files, extracted resume content and
            published page from our systems within 30 days. Diagnostics are an exception: they are
            not removed early by account deletion and are deleted automatically within 90 days after
            they are recorded. See our Privacy Policy for retention details, including anonymous
            uploads.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Changes to Terms",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          We reserve the right to modify these Terms at any time. We will provide notice of material
          changes at least 30 days in advance by posting the updated Terms on this page and updating
          the &quot;Last updated&quot; date. Your continued use of the Service after such
          modifications constitutes your acceptance of the revised Terms. If you do not agree to the
          new Terms, you must stop using the Service.
        </p>
      </>
    ),
  },
  {
    title: "Governing Law",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed">
          These Terms shall be governed by and construed in accordance with the laws of the State of
          Wyoming, United States of America, without regard to its conflict of law provisions. Any
          disputes arising under or in connection with these Terms shall be subject to the exclusive
          jurisdiction of the courts located in Wyoming, USA.
        </p>
      </>
    ),
  },
  {
    title: "Contact",
    body: (
      <>
        <p className="text-muted-foreground leading-relaxed mb-4">
          For questions about these Terms of Service, please contact us at:
        </p>
        <div className="rounded-lg border border-border bg-card p-4">
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="text-brand hover:text-brand-active font-medium transition-colors"
          >
            {siteConfig.supportEmail}
          </a>
        </div>
      </>
    ),
  },
];

function TermsOfServicePage() {
  const webPage = generateWebPageJsonLd(
    "Terms of Service",
    "/terms",
    termsDescription,
    "2026-10-30",
  );

  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="Last updated: October 30, 2026"
      breadcrumbLabel="Terms of Service"
      breadcrumbHref="/terms"
      jsonLd={
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPage) }}
        />
      }
      sections={SECTIONS}
    />
  );
}
