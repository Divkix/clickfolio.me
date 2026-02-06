/**
 * AI response normalization utilities.
 * Maps common alternative key names from AI models to our canonical schema keys.
 */

export function pickFirstValue(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.hasOwn(obj, key)) {
      return obj[key];
    }
  }
  return undefined;
}

export function coerceRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function coerceArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function normalizeExperienceItem(value: unknown): Record<string, unknown> {
  const obj = coerceRecord(value);
  if (!obj) return {};
  const result = { ...obj };
  if (result.title === undefined) {
    result.title = pickFirstValue(obj, ["title", "role", "position", "job_title", "jobTitle"]);
  }
  if (result.company === undefined) {
    result.company = pickFirstValue(obj, ["company", "employer", "organization", "org"]);
  }
  if (result.location === undefined) {
    result.location = pickFirstValue(obj, ["location", "city", "city_state", "cityState"]);
  }
  if (result.start_date === undefined) {
    result.start_date = pickFirstValue(obj, ["start_date", "startDate", "from"]);
  }
  if (result.end_date === undefined) {
    result.end_date = pickFirstValue(obj, ["end_date", "endDate", "to"]);
  }
  if (result.description === undefined) {
    result.description = pickFirstValue(obj, ["description", "summary", "details"]);
  }
  if (result.highlights === undefined) {
    result.highlights = pickFirstValue(obj, [
      "highlights",
      "bullets",
      "bullet_points",
      "bulletPoints",
      "achievements",
    ]);
  }
  return result;
}

function normalizeEducationItem(value: unknown): Record<string, unknown> {
  const obj = coerceRecord(value);
  if (!obj) return {};
  const result = { ...obj };
  if (result.degree === undefined) {
    result.degree = pickFirstValue(obj, ["degree", "program", "field", "major"]);
  }
  if (result.institution === undefined) {
    result.institution = pickFirstValue(obj, ["institution", "school", "university", "college"]);
  }
  if (result.location === undefined) {
    result.location = pickFirstValue(obj, ["location", "city", "city_state", "cityState"]);
  }
  if (result.graduation_date === undefined) {
    result.graduation_date = pickFirstValue(obj, [
      "graduation_date",
      "graduationDate",
      "grad_date",
      "gradDate",
      "year",
    ]);
  }
  if (result.gpa === undefined) {
    result.gpa = pickFirstValue(obj, ["gpa", "grade"]);
  }
  return result;
}

function normalizeCertificationItem(value: unknown): Record<string, unknown> {
  const obj = coerceRecord(value);
  if (!obj) {
    if (typeof value === "string") {
      return { name: value, issuer: "" };
    }
    return {};
  }
  const result = { ...obj };
  if (result.name === undefined) {
    result.name = pickFirstValue(obj, ["name", "title", "certification"]);
  }
  if (result.issuer === undefined) {
    result.issuer = pickFirstValue(obj, ["issuer", "organization", "org", "authority"]);
  }
  if (result.date === undefined) {
    result.date = pickFirstValue(obj, ["date", "issued", "issued_date", "issuedDate", "year"]);
  }
  if (result.url === undefined) {
    result.url = pickFirstValue(obj, ["url", "link"]);
  }
  return result;
}

function normalizeProjectItem(value: unknown): Record<string, unknown> {
  const obj = coerceRecord(value);
  if (!obj) {
    if (typeof value === "string") {
      return { title: value, description: "" };
    }
    return {};
  }
  const result = { ...obj };
  if (result.title === undefined) {
    result.title = pickFirstValue(obj, ["title", "name", "project"]);
  }
  if (result.description === undefined) {
    result.description = pickFirstValue(obj, ["description", "summary", "details"]);
  }
  if (result.year === undefined) {
    result.year = pickFirstValue(obj, ["year", "date", "date_range", "dateRange"]);
  }
  if (result.technologies === undefined) {
    result.technologies = pickFirstValue(obj, ["technologies", "tech_stack", "techStack"]);
  }
  if (result.url === undefined) {
    result.url = pickFirstValue(obj, ["url", "link", "demo"]);
  }
  if (result.image_url === undefined) {
    result.image_url = pickFirstValue(obj, ["image_url", "imageUrl", "image", "thumbnail"]);
  }
  return result;
}

export function normalizeAiKeys(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  const fullName = pickFirstValue(result, ["full_name", "fullName", "fullname", "name"]);
  if (fullName !== undefined) result.full_name = fullName;

  const headline = pickFirstValue(result, ["headline", "title", "role"]);
  if (headline !== undefined && result.headline === undefined) result.headline = headline;

  const summary = pickFirstValue(result, ["summary", "profile", "objective"]);
  if (summary !== undefined && result.summary === undefined) result.summary = summary;

  const contactSource =
    coerceRecord(
      pickFirstValue(result, [
        "contact",
        "contactInfo",
        "contact_information",
        "contactDetails",
        "contact_details",
      ]),
    ) ?? null;
  if (contactSource) {
    const contact = { ...contactSource };
    if (contact.email === undefined) {
      contact.email = pickFirstValue(contactSource, ["email", "e-mail", "mail"]);
    }
    if (contact.phone === undefined) {
      contact.phone = pickFirstValue(contactSource, [
        "phone",
        "phone_number",
        "phoneNumber",
        "mobile",
        "mobile_phone",
        "mobilePhone",
      ]);
    }
    if (contact.location === undefined) {
      contact.location = pickFirstValue(contactSource, [
        "location",
        "address",
        "city",
        "city_state",
        "cityState",
      ]);
    }
    if (contact.linkedin === undefined) {
      contact.linkedin = pickFirstValue(contactSource, [
        "linkedin",
        "linkedIn",
        "linkedin_url",
        "linkedinUrl",
      ]);
    }
    if (contact.github === undefined) {
      contact.github = pickFirstValue(contactSource, [
        "github",
        "gitHub",
        "github_url",
        "githubUrl",
      ]);
    }
    if (contact.website === undefined) {
      contact.website = pickFirstValue(contactSource, ["website", "portfolio", "site", "url"]);
    }
    if (contact.behance === undefined) {
      contact.behance = pickFirstValue(contactSource, ["behance"]);
    }
    if (contact.dribbble === undefined) {
      contact.dribbble = pickFirstValue(contactSource, ["dribbble", "dribble"]);
    }
    result.contact = contact;
  }

  const experienceSource = pickFirstValue(result, [
    "experience",
    "work_experience",
    "workExperience",
    "employment",
    "positions",
  ]);
  const experienceArray = coerceArray(experienceSource);
  if (experienceArray) {
    result.experience = experienceArray.map((item) => normalizeExperienceItem(item));
  }

  const educationSource = pickFirstValue(result, [
    "education",
    "education_history",
    "educationHistory",
    "studies",
  ]);
  const educationArray = coerceArray(educationSource);
  if (educationArray) {
    result.education = educationArray.map((item) => normalizeEducationItem(item));
  }

  const skillsSource = pickFirstValue(result, [
    "skills",
    "skillset",
    "skillSet",
    "technical_skills",
    "technicalSkills",
  ]);
  const skillsArray = coerceArray(skillsSource);
  if (skillsArray) {
    if (skillsArray.every((item) => typeof item === "string")) {
      result.skills = [{ category: "Skills", items: skillsArray as string[] }];
    } else {
      result.skills = skillsArray;
    }
  }

  const certificationsSource = pickFirstValue(result, [
    "certifications",
    "certificates",
    "licenses",
  ]);
  const certificationsArray = coerceArray(certificationsSource);
  if (certificationsArray) {
    result.certifications = certificationsArray.map((item) => normalizeCertificationItem(item));
  }

  const projectsSource = pickFirstValue(result, [
    "projects",
    "project_experience",
    "projectExperience",
    "portfolio",
    "personal_projects",
    "personalProjects",
  ]);
  const projectsArray = coerceArray(projectsSource);
  if (projectsArray) {
    result.projects = projectsArray.map((item) => normalizeProjectItem(item));
  }

  return result;
}
