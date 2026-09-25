import { generateFAQJsonLd, generateHomepageJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

export function HomeJsonLd() {
  const homepageJsonLd = generateHomepageJsonLd();
  const faqJsonLd = generateFAQJsonLd();

  return (
    <>
      {homepageJsonLd.map((schema) => (
        <script
          key={`homepage-jsonld-${JSON.stringify(schema["@id"])}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
    </>
  );
}
