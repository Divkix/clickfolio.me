import { notFound } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import type { RoleItem } from "@/components/role/RoleSection";
import { getGalleryProfiles } from "@/lib/data/indexable-profiles";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import { appLayer } from "@/lib/effect/layers";

export async function examplePageData(slug: string) {
  const gallery = EXAMPLE_GALLERIES.find((entry) => entry.slug === slug);
  const copy = Object.entries(galleryCopy).find(([key]) => key === slug)?.[1];

  if (!gallery || !copy) throw notFound();

  const profiles = await runPage(
    Db.use((service) =>
      service.query("examples.gallery", (db) => getGalleryProfiles(db, gallery.handles)),
    ),
    appLayer(env),
  );

  return { gallery, copy, profiles, indexable: profiles.length >= 3 };
}

const galleryCopy = {
  marketing: {
    intro:
      "Explore resume-based portfolios from marketers and content professionals. Use these public examples to compare how experience, skills, and results read on a hosted portfolio before creating your own.",
    observations: [
      {
        lead: "Results before responsibilities",
        body: "When writing your own page, lead with measurable campaign outcomes rather than a list of everyday tasks.",
      },
      {
        lead: "Brand and audience context",
        body: "Explain which brands, channels, or audiences your work served so a reader can understand the scope.",
      },
      {
        lead: "A clear marketing focus",
        body: "A specific headline and relevant skills help readers distinguish content, social media, and growth experience.",
      },
      {
        lead: "Readable experience",
        body: "Keep each role focused on the work you owned and the outcomes you can support from your resume.",
      },
    ],
  },
  engineering: {
    intro:
      "Browse resume-based portfolios across engineering disciplines, from software and DevOps to mechanical and chemical engineering. Compare how a public portfolio can connect technical experience, tools, and education in one shareable page.",
    observations: [
      {
        lead: "Projects with context",
        body: "Describe the problem, your contribution, and the result when presenting a technical project on your own page.",
      },
      {
        lead: "Tools tied to work",
        body: "Support a skills list with experience that explains how you used the languages, systems, or engineering tools.",
      },
      {
        lead: "A recognizable discipline",
        body: "Use a precise headline so readers can quickly tell which engineering roles match your background.",
      },
      {
        lead: "Evidence of progression",
        body: "Present relevant education and experience clearly rather than expecting readers to infer your technical foundation.",
      },
    ],
  },
  student: {
    intro:
      "See resume-based portfolios from students in engineering, computer science, and business. These public examples offer a starting point for sharing education, practical skills, and early experience without needing a long employment history.",
    observations: [
      {
        lead: "Education as context",
        body: "Make your course of study and relevant education easy to find when they are central to your current experience.",
      },
      {
        lead: "Projects count as evidence",
        body: "Describe coursework, personal projects, or student activities in terms of what you made or contributed.",
      },
      {
        lead: "Early experience matters",
        body: "Include relevant internships and part-time work, with concrete responsibilities rather than inflated job titles.",
      },
      {
        lead: "A focused skills list",
        body: "Choose skills you can explain through your studies or projects instead of listing every tool you have encountered.",
      },
    ],
  },
} satisfies Record<string, { intro: string; observations: RoleItem[] }>;
