// PROTOTYPE (throwaway): three landing-page redesigns, switchable via ?variant=A|B|C
// and the floating bar (← / →). 404s in production builds. Pick one, then delete
// this route and components/home/landing/prototype/.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CredentialLanding } from "@/components/home/landing/prototype/CredentialLanding";
import { CurriculumLanding } from "@/components/home/landing/prototype/CurriculumLanding";
import { PrototypeSwitcher } from "@/components/home/landing/prototype/PrototypeSwitcher";
import { StudioLanding } from "@/components/home/landing/prototype/StudioLanding";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const VARIANTS = {
  A: { name: "Credential", Component: CredentialLanding },
  B: { name: "Studio", Component: StudioLanding },
  C: { name: "Curriculum", Component: CurriculumLanding },
};

export default async function LandingPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { variant } = await searchParams;
  const key = (["A", "B", "C"] as const).find((k) => k === variant) ?? "A";
  const { Component } = VARIANTS[key];

  return (
    <>
      <Component />
      <PrototypeSwitcher
        variants={Object.entries(VARIANTS).map(([k, v]) => ({ key: k, name: v.name }))}
        current={key}
      />
    </>
  );
}
