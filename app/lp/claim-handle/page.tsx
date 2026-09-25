import type { Metadata } from "next";
import { ClaimHandleLanding } from "@/components/home/landing/ClaimHandleLanding";
import { HomeJsonLd } from "@/components/home/landing/HomeJsonLd";
import { HOME_METADATA } from "@/lib/seo/page-metadata";

export const revalidate = 3600;

// Served at `/` via proxy rewrite (ADR-0027), so metadata + canonical match home.
export const metadata: Metadata = HOME_METADATA;

export default function ClaimHandleLandingPage() {
  return (
    <>
      <HomeJsonLd />
      <ClaimHandleLanding />
    </>
  );
}
