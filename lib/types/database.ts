// Project structure extracted from resume (personal projects, side work, portfolio)
export interface Project {
  title: string;
  description: string;
  year?: string;
  technologies?: string[];
  url?: string;
  image_url?: string;
}

// Resume content structure (from AI parsing)
export interface ResumeContent {
  full_name: string;
  headline: string;
  summary: string;
  contact: {
    email: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    start_date: string;
    end_date?: string;
    description: string;
    highlights?: string[];
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    location?: string;
    graduation_date?: string;
    gpa?: string;
  }>;
  skills?: Array<{
    category: string;
    items: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
    url?: string;
  }>;
  projects?: Project[];
}
