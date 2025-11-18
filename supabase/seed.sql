-- Seed data for local development
-- This runs automatically after migrations with `bun run db:reset`

-- Demo user profile with complete resume data
-- Note: This inserts into auth.users first, then creates profile
-- For production testing, use a real Google OAuth account

-- Create demo user in auth.users
-- Password: demo123 (for local testing)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'demo@webresume.now',
  crypt('demo123', gen_salt('bf')),
  NOW(),
  '{"provider": "email"}',
  '{"full_name": "Alex Rivera", "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create demo profile
INSERT INTO profiles (
  id,
  email,
  handle,
  avatar_url,
  headline,
  privacy_settings
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'demo@webresume.now',
  'demo',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
  'Senior Full-Stack Engineer & Product Architect',
  '{"show_phone": false, "show_address": false}'::jsonb
) ON CONFLICT (handle) DO UPDATE SET
  email = EXCLUDED.email,
  avatar_url = EXCLUDED.avatar_url,
  headline = EXCLUDED.headline;

-- Create demo site data with comprehensive resume content
INSERT INTO site_data (
  user_id,
  content,
  theme_id,
  last_published_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '{
    "full_name": "Alex Rivera",
    "headline": "Senior Full-Stack Engineer & Product Architect",
    "summary": "Innovative software engineer with 8+ years building scalable web applications and leading cross-functional teams. Specialized in TypeScript, React, and distributed systems. Passionate about developer experience, performance optimization, and mentoring junior engineers. Track record of shipping products used by millions while maintaining 99.9% uptime.",
    "contact": {
      "email": "alex.rivera@example.com",
      "phone": "+1 (555) 123-4567",
      "location": "123 Tech Avenue, San Francisco, CA 94102",
      "linkedin": "https://linkedin.com/in/alexrivera",
      "github": "https://github.com/alexrivera",
      "website": "https://alexrivera.dev"
    },
    "experience": [
      {
        "title": "Senior Full-Stack Engineer",
        "company": "TechCorp Industries",
        "location": "San Francisco, CA",
        "start_date": "2021-03",
        "end_date": null,
        "description": "Lead engineer for core platform services serving 5M+ monthly active users. Architected and implemented microservices migration reducing infrastructure costs by 40%.",
        "highlights": [
          "Built real-time collaboration features using WebSockets and CRDT algorithms",
          "Reduced page load times by 60% through strategic caching and code splitting",
          "Mentored 5 junior engineers and established team coding standards",
          "Led migration from REST to tRPC achieving end-to-end type safety"
        ]
      },
      {
        "title": "Full-Stack Developer",
        "company": "StartupXYZ",
        "location": "Remote",
        "start_date": "2019-01",
        "end_date": "2021-02",
        "description": "Early engineer (employee #3) building SaaS platform from zero to $2M ARR. Shipped features across frontend, backend, and DevOps infrastructure.",
        "highlights": [
          "Developed React component library used across 12+ internal projects",
          "Implemented CI/CD pipeline reducing deployment time from 2 hours to 10 minutes",
          "Built authentication system supporting OAuth, SAML, and magic links",
          "Optimized database queries improving API response times by 75%"
        ]
      },
      {
        "title": "Software Engineer",
        "company": "Digital Solutions Inc",
        "location": "Austin, TX",
        "start_date": "2017-06",
        "end_date": "2018-12",
        "description": "Full-stack engineer on enterprise applications for Fortune 500 clients. Worked with React, Node.js, and cloud infrastructure.",
        "highlights": [
          "Delivered 8 client projects on time with 95%+ satisfaction ratings",
          "Implemented automated testing suite achieving 90%+ code coverage",
          "Reduced bug escape rate by 65% through comprehensive E2E testing"
        ]
      }
    ],
    "education": [
      {
        "degree": "Bachelor of Science in Computer Science",
        "institution": "University of California, Berkeley",
        "location": "Berkeley, CA",
        "graduation_date": "2017-05",
        "gpa": "3.8"
      }
    ],
    "skills": [
      {
        "category": "Languages",
        "items": ["TypeScript", "JavaScript", "Python", "Go", "SQL"]
      },
      {
        "category": "Frontend",
        "items": ["React", "Next.js", "Vue", "Tailwind CSS", "Redux", "Zustand"]
      },
      {
        "category": "Backend",
        "items": ["Node.js", "Express", "Fastify", "tRPC", "GraphQL", "PostgreSQL"]
      },
      {
        "category": "Infrastructure",
        "items": ["AWS", "Cloudflare Workers", "Docker", "Kubernetes", "CI/CD"]
      },
      {
        "category": "Tools",
        "items": ["Git", "Webpack", "Vite", "Jest", "Playwright", "Figma"]
      }
    ],
    "certifications": [
      {
        "name": "AWS Certified Solutions Architect",
        "issuer": "Amazon Web Services",
        "date": "2022-08",
        "url": "https://aws.amazon.com/certification/"
      }
    ]
  }'::jsonb,
  'minimalist_creme',
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  content = EXCLUDED.content,
  theme_id = EXCLUDED.theme_id,
  last_published_at = EXCLUDED.last_published_at;

-- To use this seed data:
-- 1. Start local Supabase: bun run db:start
-- 2. Reset database with seed: bun run db:reset
-- 3. Visit: http://localhost:3000/demo
-- 4. The demo user can log in with: demo@webresume.now / demo123
