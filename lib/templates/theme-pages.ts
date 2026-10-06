import type { ThemeId } from "@/lib/templates/theme-ids";

export const THEME_PAGE_COPY: Record<
  ThemeId,
  { title?: string; description: string; paragraphs: readonly string[] }
> = {
  bento: {
    description:
      "Build a free Bento Grid resume website with flat color tiles, a portrait, and clearly grouped experience, skills, and projects.",
    paragraphs: [
      "Bento Grid suits product managers and marketers who want readers to scan several kinds of work at once. Flat color tiles separate your introduction, contact details, experience, and skills, while your portrait anchors the top of the page.",
      "The layout adapts to the sections in your resume: neighboring tiles expand when a section is absent instead of leaving an empty space. On smaller screens, the tiles become a single column. Pine-green accents and rounded corners give a structured resume a more approachable presentation.",
    ],
  },
  boardroom: {
    description:
      "Present your career in Boardroom, a free dark resume website template with a pinned identity column, ruled experience ledger, and brass accents.",
    paragraphs: [
      "Boardroom is made for directors, consultants, and finance and operations leaders who want a serious page that does not look like a corporate template. Your name, contact links, and skills stay pinned on the left while your experience scrolls beside them.",
      "Roles are set as a ruled ledger with the dates in a monospaced margin, so tenure is easy to scan. Ivory text on near-black, with a single brass accent for company names and rules, keeps the page calm. On narrow screens the identity block moves above the ledger.",
    ],
  },
  bold_corporate: {
    description:
      "Choose Bold Corporate for a free resume website with a navy sidebar, condensed headings, and an annual-report-inspired layout.",
    paragraphs: [
      "Bold Corporate is a good fit for consultants and product managers whose experience needs a clear professional hierarchy. Its annual-report-inspired design places your name, contact links, and skills in a navy sidebar, leaving the main area for your career story.",
      "Condensed display headings and thick navy section rules make the page easy to navigate without turning every entry into a card. White and slate supporting colors keep the attention on job titles, descriptions, and achievements rather than decorative effects.",
    ],
  },
  broadsheet: {
    description:
      "Use Broadsheet for a free resume website styled as a newspaper front page, with a masthead name, ruled columns, and roles set as short stories.",
    paragraphs: [
      "Broadsheet suits economists, analysts, consultants, and finance professionals who want an editorial page with weight. Your name is set as the masthead, your headline becomes the lead, and each role reads like a short story with a company kicker and a dated byline.",
      "Experience runs in ruled columns beside a narrow index of education, skills, and contact details. On phones the columns collapse into one, and the paper-toned background gives way to plain white when printed. Oxblood kickers and warm ink keep it formal without feeling dated.",
    ],
  },
  case_file: {
    description:
      "Present your experience in Case File, a free resume website template with a manila-folder dossier, typed headings, and lettered exhibits.",
    paragraphs: [
      "Case File turns a consultant's professional history into a typed dossier on a dark desk. The manila-folder setting, intake-form header, and clipped photograph make it a distinctive alternative to a conventional business portfolio.",
      "Each resume section is a lettered exhibit, with letters assigned only to sections that exist. Dates sit beside entries on wider screens and above them on narrow screens. The result is a document-led layout for readers who want to examine your experience in detail.",
    ],
  },
  classic_ats: {
    description:
      "Create a free Classic ATS resume website: a simple one-column sheet with text headings and browser print or save-as-PDF support.",
    paragraphs: [
      "Classic ATS suits students and product managers who prefer a familiar resume sheet over a decorative portfolio. A single column, text headings, and straightforward entries make it an ATS friendly resume template in structure, without tables or icons carrying essential information. No template can guarantee compatibility with every applicant tracking system.",
      "Garamond typography, navy headings, and a white letter-size sheet keep the focus on your qualifications. The template includes a print stylesheet and a print button, so you can print or save as PDF from your browser. Check the resulting document before submitting it to an employer.",
    ],
  },
  design_folio: {
    description:
      "Explore DesignFolio, a free resume website template with a Swiss grid, cobalt name block, and image-led project presentation.",
    paragraphs: [
      "DesignFolio is for designers who want their projects to lead the conversation. Its Swiss-grid layout pairs cool gray paper with black typography and a large cobalt name block, giving your professional identity a strong visual starting point.",
      "The opening composition places your headline and summary beside your name rather than beneath it. Project images lead the work section when available, while bold section rules keep experience and education part of the same visual system. Choose it when the work itself should carry as much weight as the resume text.",
    ],
  },
  dev_terminal: {
    description:
      "Build a free developer portfolio website with DevTerminal's GitHub-style profile, README introduction, project cards, and experience timeline.",
    paragraphs: [
      "DevTerminal gives a developer portfolio website the familiar shape of a GitHub-style profile. A profile sidebar, section navigation, and a README-style introduction let software engineers present their background in a setting that feels close to their everyday tools.",
      "Project cards include descriptions, links, and technology labels when those details are present. Your resume experience is displayed with commit-style markers; it is a visual timeline, not a live GitHub activity feed. Dark surfaces and monospace accents reinforce the developer identity without requiring visitors to type commands.",
    ],
  },
  glass: {
    description:
      "Make a free Glass Morphic resume website with frosted panels, an indigo aurora background, and floating section navigation.",
    paragraphs: [
      "Glass Morphic suits software engineers and marketers who want a modern, atmospheric portfolio rather than a paper-like resume. Frosted panels sit over an indigo aurora, with teal and rose accents surrounding the opening introduction.",
      "A large name and headline establish the page before separate panels organize your work and qualifications. Floating navigation near the bottom links directly to the available sections. The translucent treatment provides visual depth while keeping the resume content in a familiar reading order.",
    ],
  },
  midnight: {
    description:
      "Choose Midnight for a free resume website with a blue night sky, Garamond headings, a centered introduction, and a gold star timeline.",
    paragraphs: [
      "Midnight is a quieter dark-theme option for students who want their first portfolio to feel considered. A blue night sky frames a centered portrait, name, and headline, while warm gold details soften the contrast.",
      "Garamond display headings give the page a literary tone, with sans-serif text supporting longer descriptions. Star-shaped markers organize the experience timeline. It is a useful choice when you want a memorable setting without the louder poster styling of a creative theme.",
    ],
  },
  minimalist_editorial: {
    description:
      "Create a free minimalist portfolio website with Minimalist Editorial's serif typography, single reading column, and dates in the margin.",
    paragraphs: [
      "Minimalist Editorial is a minimalist portfolio website for software engineers and consultants who want the writing to do the work. A quiet white page, serif typography, and a single reading column give your summary and experience room to breathe.",
      "On wide screens, dates hang in the left margin like notes in a book; on smaller screens, they move above each entry. Restrained green links provide the main color accent. Choose this template when thoughtful descriptions and a clear career narrative matter more than visual spectacle.",
    ],
  },
  neo_brutalist: {
    description:
      "Stand out with Neo Brutalist, a free resume website template featuring a yellow poster layout, giant name, hard shadows, and a skills ticker.",
    paragraphs: [
      "Neo Brutalist suits designers who want their portfolio to announce a strong visual personality. Its yellow poster-style background, oversized name, black borders, and hard shadows deliberately move away from a conventional resume sheet.",
      "A skills ticker and bold section navigation carry that graphic language through the page. White content slabs keep descriptions readable, while the portrait and contact links become part of the composition. Pick it when an assertive presentation matches the kind of creative work you want to share.",
    ],
  },
  retro_os: {
    description:
      "Build a free Retro OS resume website with a late-90s desktop, teal wallpaper, section icons, and bevelled windows for your career story.",
    paragraphs: [
      "Retro OS is for students who want to show some personality alongside their qualifications. Teal wallpaper, desktop icons, and bevelled gray windows turn the portfolio into a late-90s desktop, with each resume section styled as its own window.",
      "The desktop icons jump to the corresponding sections, and a taskbar finishes the page. Window controls are decorative rather than a full operating-system simulation. Your experience and projects remain ordinary readable web content beneath the nostalgic interface.",
    ],
  },
  spotlight: {
    description:
      "Put your name center stage with Spotlight, a free resume website template with a lilac backdrop, warm stage light, and playbill-style sections.",
    paragraphs: [
      "Spotlight works for designers and marketers who want their name and professional introduction to take center stage. A pale lilac background, aubergine typography, and a warm pool of stage light frame the oversized opening name.",
      "The rest of the page reads like a playbill: section titles sit beside the supporting work on wider screens, then stack above it on mobile. Yellow-underlined links echo the opening light. It offers a more expressive personal introduction while preserving a straightforward account of your experience.",
    ],
  },
  academic_cv: {
    title: "Academic CV Website Template",
    description:
      "Build a free academic CV website with a layout that puts education first, dates appointments, and numbers your research and selected work. Print-ready.",
    paragraphs: [
      "Academic CV is built for graduate students, postdocs, and faculty who need a CV that lives on the web. Education leads, followed by appointments, then research and selected work listed newest first with numbered entries. A sticky index on wide screens jumps to each section your resume contains.",
      "The resume parser reads projects, so papers, talks, and software appear under Research & Selected Work with their year, link, and keywords. Honors and certifications are listed with dates. A print button turns the page into a clean PDF CV, and on phones the index becomes a scrolling strip above the content.",
    ],
  },
  contact_sheet: {
    title: "Photography Portfolio Website Template",
    description:
      "Build a free photography portfolio website: film-frame project tiles on near-black, assignments listed like a shoot log, and a clean fallback when you have no images.",
    paragraphs: [
      "Contact Sheet is for photographers and visual storytellers. Your projects become numbered film frames in a grid, with the first one circled in grease-pencil orange. Each frame shows its year, description, and keywords, and links out when the project has a URL.",
      "If a project includes an image, the frame displays it; if not, the project title fills the frame so the grid never has gaps. Experience reads as a log of assignments, with dates set in a monospace column. Training, kit and technique, and awards sit in columns at the end, and the page collapses to one column on phones.",
    ],
  },
  workspace: {
    title: "Notion-Style Portfolio Website Template",
    description:
      "Create a free portfolio website with Workspace: a clean document-style page with a cover, properties table, collapsible sections and tag labels, built from your resume.",
    paragraphs: [
      "Workspace gives your resume the look of a well-kept document: a soft cover band, a page icon, and a properties table where your role, email, location, and links line up as rows. Your summary appears as a callout, and each section opens and closes like a toggle block, so visitors can skim or dive in.",
      "Skills and project keywords become colored tags, and projects sit in a two-column gallery of cards. It is a natural fit for product managers, engineers, and anyone who already plans their work in documents. It is an independent design, not affiliated with or endorsed by any note-taking app.",
    ],
  },
};
