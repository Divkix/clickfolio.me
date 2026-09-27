import { Breadcrumb } from "@clickfolio/ui";

export const Profile = () => (
  <Breadcrumb
    includeJsonLd={false}
    items={[
      { label: "Home", href: "/" },
      { label: "Explore", href: "/explore" },
      { label: "@janedoe", href: "/@janedoe" },
    ]}
  />
);

export const BlogPost = () => (
  <Breadcrumb
    includeJsonLd={false}
    items={[
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: "How to turn your resume into a portfolio", href: "/blog/resume-to-portfolio" },
    ]}
  />
);
