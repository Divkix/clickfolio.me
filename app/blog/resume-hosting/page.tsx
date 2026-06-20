import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("resume-hosting")!;
const relatedPosts = ["pdf-resume-to-website", "personal-resume-website"]
  .map((slug) => getPostBySlug(slug))
  .filter(Boolean) as (typeof post)[];

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function ResumeHostingPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <h2>What is resume hosting?</h2>
        <p>
          Resume hosting means putting your resume online so you can share it with one link instead
          of emailing a file. The best approach hosts your resume as a live web page, not a PDF on a
          file server. <Link href="/">clickfolio.me</Link> hosts your resume as a website at{" "}
          <code>clickfolio.me/@yourhandle</code> free, so the link is always current and you can see
          who's viewing it.
        </p>
        <p>
          A hosted resume beats an attachment in three ways: it's easier to share, it never goes
          stale, and it can tell you whether anyone actually opened it. Here's how to set one up and
          when to still send a PDF.
        </p>
      </section>

      <section>
        <h2>Where can you host your resume online for free?</h2>
        <p>
          You have a few options, and they're not equal. A file host stores a document; a resume
          website hosts a page people can read on any device.
        </p>
        <ul>
          <li>
            <strong>Resume website (recommended).</strong> Tools like clickfolio.me turn your PDF
            into a hosted page with a clean link, mobile layout, and analytics — free.
          </li>
          <li>
            <strong>Cloud file storage.</strong> Google Drive or Dropbox can share a PDF link, but
            visitors download a file instead of reading a page, and you get no real analytics.
          </li>
          <li>
            <strong>Your own domain.</strong> Full control, but you handle hosting, design, and
            upkeep yourself.
          </li>
        </ul>
        <p>
          For most people, a resume website is the sweet spot: free, professional, and zero
          maintenance. If you want to understand the underlying conversion, see{" "}
          <Link href="/blog/pdf-resume-to-website">how a PDF resume becomes a website</Link>.
        </p>
      </section>

      <section>
        <h2>How to host your resume in 30 seconds</h2>
        <p>If you already have a resume PDF, hosting it is quick:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Export your resume as a PDF.</strong> Use the copy you send to employers.
          </li>
          <li>
            <strong>Upload it.</strong> The AI reads your experience, skills, and contact details
            and builds the page.
          </li>
          <li>
            <strong>Choose a template.</strong> Pick from 10 designs and adjust anything that needs
            a fix.
          </li>
          <li>
            <strong>Publish and copy your link.</strong> Your resume is live at a shareable handle
            you can paste anywhere.
          </li>
        </ol>
        <p>
          That's the whole process. You upload once, and the link stays live — update the content
          and the same URL always shows your latest version.
        </p>
      </section>

      <section>
        <h2>PDF attachment vs hosted resume link</h2>
        <p>You don't have to choose one forever, but it helps to know what each is good at.</p>
        <div className="overflow-x-auto my-8 not-prose">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
            <thead>
              <tr>
                <th className="border border-border p-3 text-left font-semibold">Factor</th>
                <th className="border border-border p-3 text-left font-semibold">PDF attachment</th>
                <th className="border border-border p-3 text-left font-semibold">
                  Hosted resume link
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-3">Sharing</td>
                <td className="border border-border p-3">Attach a file each time</td>
                <td className="border border-border p-3">One link, paste anywhere</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Staying current</td>
                <td className="border border-border p-3">Old copies float around</td>
                <td className="border border-border p-3">Always shows the latest version</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Analytics</td>
                <td className="border border-border p-3">None</td>
                <td className="border border-border p-3">See views and visits</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Mobile reading</td>
                <td className="border border-border p-3">Pinch and zoom</td>
                <td className="border border-border p-3">Responsive page</td>
              </tr>
              <tr>
                <td className="border border-border p-3">ATS uploads</td>
                <td className="border border-border p-3">Required by most systems</td>
                <td className="border border-border p-3">Not a file upload</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The takeaway: keep a PDF for applications that demand a file, and use a hosted link
          everywhere else. Most application systems still want a PDF upload, so don't throw yours
          away.
        </p>
      </section>

      <section>
        <h2>Can you track who views your hosted resume?</h2>
        <p>
          Yes — and it's one of the strongest reasons to host. clickfolio.me includes built-in
          analytics, so you can see how many people viewed your page. A PDF sitting in someone's
          inbox tells you nothing. With 70% of employers researching candidates online before hiring
          (CareerBuilder/Harris Poll, 2017), knowing your link is getting opened is genuinely useful
          signal.
        </p>
        <p>
          You also stay in control of what's visible. Hide your contact details, keep the page
          public, or unlist it — your call. Because clickfolio.me is open source (MIT) and runs on
          Cloudflare, the page loads fast and you can verify how your data is handled.
        </p>
      </section>

      <section>
        <h2>Where to put your resume link</h2>
        <p>
          A hosted resume only helps if people find it. Once it's live, add the link to your job
          applications, your email signature, your LinkedIn profile, and your social bios. If you're
          deciding how a hosted resume fits alongside a full portfolio, our guide on{" "}
          <Link href="/blog/personal-resume-website">personal resume websites</Link> goes deeper.
        </p>
        <p>
          Stop attaching the same file over and over. Host it once, share one link, and watch the
          views come in.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Host your resume free and get your shareable link →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
