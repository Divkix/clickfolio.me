const name = "clickfolio";
const tld = ".me";
const domain = "clickfolio.me";

export const siteConfig = {
  name,
  tld,
  domain,
  fullName: `${name}${tld}`,
  tagline: "Turn your resume into a website",
  supportEmail: "support@clickfolio.me",
  url: `https://${domain}`,
  alternateNames: ["clickfolio", "click folio", "Clickfolio"],
  sameAs: ["https://github.com/divkix/clickfolio.me"],
  founder: {
    name: "Divanshu Chauhan",
    url: "https://divkix.me",
    sameAs: [
      "https://divkix.me",
      "https://github.com/divkix",
      "https://www.linkedin.com/in/divkix/",
      "https://x.com/divkix",
      "https://orcid.org/0009-0004-0423-2471",
    ],
  },
} as const;
