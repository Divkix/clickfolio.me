import type { ThemeId } from "@/lib/templates/theme-ids";

export const THEME_PAGE_COPY: Record<
  ThemeId,
  { title?: string; description: string; paragraphs: readonly string[] }
> = {
  bento: {
    description:
      "Build a free Bento Grid resume website with flat color tiles for your current role, a standout result, and clearly grouped experience, skills, and projects.",
    paragraphs: [
      "Bento Grid suits product managers and marketers who want readers to scan several kinds of work at once. Flat color tiles separate your introduction, contact details, experience, and skills. Beside your name sit your current role and location, and your strongest measurable result gets a tile of its own.",
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
      "Make a free Glass Morphic resume website with frosted glass panes, a single window of light, and a sticky frosted navigation bar.",
    paragraphs: [
      "Glass Morphic suits software engineers and marketers who want a modern, atmospheric portfolio rather than a paper-like resume. Frosted panes sit in a dark room lit by one tall window, and a strip of reeded glass beside your introduction breaks that light into ribs.",
      "A large name and headline establish the page before separate panels organize your work and qualifications. A frosted bar stays at the top of the screen and links to each section, with the page scrolling underneath it. Every pane catches the light on the same edge, which gives the page depth while keeping your resume in a familiar reading order.",
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
      "Put your name center stage with Spotlight, a free resume website template with a dark stage, a followspot on your name, and theatre-programme sections.",
    paragraphs: [
      "Spotlight is for creative directors, performers, and leaders who want a big-name page. A red curtain hangs over a dark stage, and a single followspot lands on your name, set huge in a fat-face serif under the word Starring.",
      "The rest of the page reads like a theatre programme. Your summary is the Who's who bio, jobs are listed as Credits with role and company joined by a dotted leader like a cast list, skills appear under Featuring, and education is listed as Training. The contact section at the end is the Stage door.",
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
  blueprint: {
    title: "Architecture Portfolio Website Template",
    description:
      "Create a free architecture portfolio website with Blueprint: a cyanotype drawing sheet with grid paper, lettered sections, dimension-line dates and a title block.",
    paragraphs: [
      "Blueprint presents your career as a drawing set. White linework on cyanotype blue frames the sheet, sections are lettered like drawing callouts, and each role's dates run along a dimension line. Projects become numbered details with a spec line for materials, methods, or tools.",
      "It suits architects, engineers, and designers of physical things, and works well for technical students too. Skills appear as a legend, education and approvals as ruled tables, and a title block at the foot carries your name and handle. On phones, the sheet narrows to a single column and the dimension lines give way to plain dates.",
    ],
  },
  scrapbook: {
    title: "Student Portfolio Website Template",
    description:
      "Make a free student portfolio website with Scrapbook: a craft-paper desk of taped index cards, sticky-note skills and a polaroid portrait. Education comes first.",
    paragraphs: [
      "Scrapbook is a student portfolio website that feels like a desk covered in your work. A polaroid-style portrait sits beside your name, your summary is written on lined notebook paper, and each role or project is a taped index card tilted a degree or two.",
      "Because students often have more coursework than job history, education comes first, shown as ticket stubs. Skills are sticky notes, certificates are tickets, and project keywords become small outlined tags. The cards stack into a single column on phones, and everything stays plain, readable text underneath the decoration.",
    ],
  },
  media_kit: {
    title: "Marketing Portfolio Website Template",
    description:
      "Build a free marketing portfolio website with Media Kit: a bold colour-block hero, a results wall pulled from your resume metrics, and a by-the-numbers strip.",
    paragraphs: [
      "Media Kit is built for marketers who sell results. A violet hero carries your name and headline, and a by-the-numbers strip counts the roles, brands, and campaigns on your resume. Any achievement that includes a figure, such as 212%, $2.1M, or 3.4x, is lifted into a Results wall with the original sentence beside it.",
      "Nothing is rewritten: figures are shown exactly as you wrote them, and a resume with no metrics simply skips the wall. Experience, campaigns with their channels, a brands and teams list, and skills follow, ending in a dark contact band with your email as the call to action.",
    ],
  },
  liner_notes: {
    title: "Musician Website Template",
    description:
      "Build a free music portfolio website with Liner Notes: an album sleeve with the record sliding out, your jobs as Side A tracks and recordings on Side B.",
    paragraphs: [
      "Liner Notes is for musicians, actors, and dancers whose careers read as a list of credits. Your name is set as the album title on a sleeve with the record sliding out, your summary is the liner note, and each role is numbered as a Side A track with its dates on the right.",
      "Recordings, tours, and other projects from your resume fill Side B, skills are set as personnel credits, and education sits under a recorded-at heading. On phones the sleeve stacks above the track list, and the paper-toned back cover keeps longer descriptions readable.",
    ],
  },
  rounds: {
    title: "Nurse Resume Website Template",
    description:
      "Create a free nursing portfolio website with Rounds: a staff ID badge on a lanyard, licenses and certifications first, and experience set as a shift log.",
    paragraphs: [
      "Rounds is for nurses and healthcare professionals whose licenses are the first thing a recruiter checks. A staff ID badge on a lanyard carries your name, credentials, and role, and licenses and certifications appear as cards before the rest of the page.",
      "Experience reads as a shift log, with dates and units in a left column beside each role and its achievements. Clinical skills become pill-shaped chips, education closes the page in its own card, and a scrub-blue accent keeps the layout calm. On phones the badge moves above the shift log.",
    ],
  },
  lesson_plan: {
    title: "Teacher Portfolio Website Template",
    description:
      "Build a free teacher portfolio website with Lesson Plan: a ruled planner page with binder holes, coloured subject tabs and a handwritten sticky note.",
    paragraphs: [
      "Lesson Plan is for teachers, tutors, and school staff who want a portfolio that feels like their classroom. A handwritten greeting sits above your name on a ruled planner page with binder holes, a red margin line, and coloured subject tabs.",
      "Each section is labelled with its own tab colour, a rotated sticky note carries your summary, and key lines such as awards are set in handwriting. Licenses and education sit side by side near the end, and the tabs and note hide on phones so the page stays a single column.",
    ],
  },
  manuscript: {
    title: "Writer Portfolio Website Template",
    description:
      "Create a free writer portfolio website with Manuscript: a two-page book spread with a table of contents, bylines as a bibliography and a ribbon bookmark.",
    paragraphs: [
      "Manuscript is for writers, journalists, editors, and copywriters who want their portfolio to read like a printed book. A two-page spread on a dark board opens with a title page, with your introduction set as a frontispiece quote and your contact details in the colophon.",
      "The second page holds a table of contents and the chapters: staff positions, selected work set as a bibliography with italic publication names, and editing, education, and fellowships. A red ribbon bookmark marks the spread, and the two pages fold into one column on phones.",
    ],
  },
  gallery_wall: {
    title: "Art Portfolio Website Template",
    description:
      "Build a free art portfolio website with Gallery Wall: an exhibition title in vinyl, hung works with wall labels and an artist CV below the floor line.",
    paragraphs: [
      "Gallery Wall is for artists, illustrators, and makers whose work belongs on a wall. Your name is set as an exhibition title in vinyl lettering, and your projects hang at eye level, each with a white wall label carrying its year, medium, and description.",
      "Below the floor line, experience and awards are printed the way galleries set an artist's CV, with dates in their own column and media and tools listed beside them. The hang and the CV collapse into one column on phones.",
    ],
  },
  quota: {
    title: "Sales Resume Website Template",
    description:
      "Build a free sales resume website with Quota: a closed-won board of your real numbers and a track record set in big condensed type.",
    paragraphs: [
      "Quota is built for account executives and sales professionals who want their numbers to lead. Any figure already written in your highlights, like a quota percentage, a pipeline dollar amount or a 3x multiple, is lifted onto a dark closed-won board at the top of the page, next to the line it came from and the company where you earned it.",
      "Nothing is counted or estimated: a resume without those figures simply skips the board. Below it, each role runs as a dated row in your track record with the figures marked in orange-red, and your skills read as a short playbook grouped the way you listed them.",
    ],
  },
  the_brief: {
    title: "Attorney Resume Website Template",
    description:
      "Make a free attorney resume website with The Brief: a boxed caption header, roman-numeral sections and double-spaced serif paragraphs.",
    paragraphs: [
      "The Brief borrows the shape of a filed legal brief for a law resume: a boxed caption header holds your name and headline, and each section is introduced with a roman numeral the way a brief numbers its arguments.",
      "Highlights are lettered like sub-points in a pleading, and the page runs on navy and muted gold rather than courtroom red. It suits attorneys, paralegals, and compliance professionals who want a page that reads as careful as their actual work.",
    ],
  },
  open_house: {
    title: "Real Estate Agent Website Template",
    description:
      "Create a free real estate agent website with Open House: your name on a yard sign, a property-details table and roles filed as listings.",
    paragraphs: [
      "Open House sets a real-estate resume up like the listing sheets agents already work from. Your name hangs on a green yard sign with your phone number as large as the name and your brokerage on the rider below, the way buyers see it from the curb.",
      "Underneath, an MLS-style property-details table lists your location, brokerage, specialties, licenses and education as plain facts, and each role is filed in your listing history marked Active or Closed. Every line comes from your own resume, with no invented sales figures or counts.",
    ],
  },
  the_menu: {
    title: "Chef Resume Website Template",
    description:
      "Build a free chef resume website with The Menu: a bistro prix-fixe card on a red gingham tablecloth, with your roles listed like dishes.",
    paragraphs: [
      "The Menu sets your resume as a prix-fixe card in a double-ruled frame. Training is the first course, your roles are the main course, and certifications come out for dessert. Each role runs along a dotted leader to its years, the way a dish runs to its price.",
      "Your skills go in the pantry, an oxblood insert printed like a wine list, and your contact details sit under Reservations at the foot of the card. It suits chefs, restaurateurs and hospitality professionals who want a page that looks like the menus they write.",
    ],
  },
  personal_best: {
    title: "Personal Trainer Resume Website Template",
    description:
      "Make a free personal trainer resume website with Personal Best: bold PR-style stat cards and a neon accent on near-black.",
    paragraphs: [
      "Personal Best gives a fitness or coaching resume the same energy as a training log. A diagonal colour split sits behind your name, and any number already in your highlights — a percentage, a rep count, a season record — gets pulled out into its own bold stat card.",
      "Nothing is invented: the stats are read directly out of your own achievement bullets, not estimated. Condensed uppercase headings and a single cyan accent keep the page feeling like a locker-room poster rather than a corporate template.",
    ],
  },
  pitch_deck: {
    title: "Startup Founder Resume Website Template",
    description:
      "Build a free founder resume website with Pitch Deck: your career as a 16:9 slide deck, from title slide to the ask.",
    paragraphs: [
      "Pitch Deck presents a founder's background the way they'd present their own company. Each section is its own widescreen slide with a page number in the footer: a cobalt title slide with your name, the one-liner, traction from your current role, your track record, what you've built, and your background.",
      "Every slide carries one idea in big headline type, and the deck closes on a cobalt slide with your email and links. It suits founders, operators, and early-stage hires who think in decks as naturally as they think in resumes.",
    ],
  },
  reel: {
    title: "Video Editor Portfolio Website Template",
    description:
      "Build a free video editor portfolio website with Reel: a film-editing timeline, timecode-styled dates and a red playhead accent.",
    paragraphs: [
      "Reel borrows the look of an editing timeline for a filmmaker's resume: a red playhead rule opens the page, and every role sits on a vertical clip track with its dates styled like a timecode and a small marker tick at each entry.",
      "Projects sit in a dark grid below, each with its own tools listed in monospace. It suits video editors, filmmakers, and motion designers who want their resume to look like the software they work in every day.",
    ],
  },
  link_stack: {
    title: "Link-in-Bio Resume Website Template",
    description:
      "Make a free link-in-bio resume website with Link Stack: your name set big, then every link, job and credential as a full-width colour bar.",
    paragraphs: [
      "Link Stack is deliberately not a resume layout. It's a creator-style bio page: your name set large in a wide display face, then a stack of edge-to-edge bars. Your email and social links come first, then projects, jobs, education and skills, and every bar is something to tap: a link opens, a job unfolds to show what you did there.",
      "The bars run as one colour ramp from deep ultramarine down to peach, so the page reads in order at a glance on a phone, and on a desktop screen the bars stretch across the whole window instead of sitting in a narrow strip. It suits freelancers, consultants and content creators who want their resume to work like the link in their bio.",
    ],
  },
};
