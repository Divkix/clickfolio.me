import type { Metadata } from "next";
import { HomeLanding } from "@/components/home/landing/HomeLanding";
import { HomeJsonLd } from "@/components/home/landing/HomeJsonLd";
import { HOME_METADATA } from "@/lib/seo/page-metadata";

export const revalidate = 3600;

export const metadata: Metadata = HOME_METADATA;

export default function Home() {
  return (
    <>
      <HomeJsonLd />
      <HomeLanding />
    </>
  );
}
