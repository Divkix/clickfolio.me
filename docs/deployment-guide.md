# Deployment Guide - webresume.now

Complete guide for deploying webresume.now to Cloudflare Workers with Supabase and R2.

---

## Prerequisites

- Cloudflare account with Workers enabled
- Supabase account with project created
- Cloudflare R2 bucket created
- Replicate account with API access
- Domain configured (optional but recommended)

---

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Wait for database provisioning (~2 minutes)
4. Note your project URL and anon key

### Database Schema

Run these SQL commands in the Supabase SQL Editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE NOT NULL CHECK (LENGTH(handle) >= 3 AND LENGTH(handle) <= 30),
  email TEXT NOT NULL,
  avatar_url TEXT,
  headline TEXT,
  privacy_settings JSONB DEFAULT '{"show_phone": false, "show_address": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create resumes table
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_claim', 'processing', 'completed', 'failed')),
  error_message TEXT,
  replicate_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create site_data table
CREATE TABLE site_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  content JSONB NOT NULL,
  theme_id TEXT DEFAULT 'minimalist_creme',
  last_published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create redirects table (for handle changes)
CREATE TABLE redirects (
  old_handle TEXT PRIMARY KEY,
  new_handle TEXT NOT NULL REFERENCES profiles(handle) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create indexes
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_status ON resumes(status);
CREATE INDEX idx_site_data_user_id ON site_data(user_id);
CREATE INDEX idx_redirects_new_handle ON redirects(new_handle);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE redirects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for resumes
CREATE POLICY "Users can view own resumes"
  ON resumes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
  ON resumes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes"
  ON resumes FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for site_data
CREATE POLICY "Published sites are viewable by everyone"
  ON site_data FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own site data"
  ON site_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own site data"
  ON site_data FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for redirects
CREATE POLICY "Redirects are viewable by everyone"
  ON redirects FOR SELECT
  USING (true);

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, handle)
  VALUES (
    NEW.id,
    NEW.email,
    SUBSTRING(MD5(NEW.email) FROM 1 FOR 12)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Configure Google OAuth

1. Go to Authentication > Providers in Supabase Dashboard
2. Enable Google provider
3. Add Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth 2.0 Client ID
   - Set authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

### Set Redirect URLs

In Authentication > URL Configuration:
- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: Add both:
  - `http://localhost:3000/**` (development)
  - `https://your-domain.com/**` (production)

### Get Service Role Key

1. Go to Settings > API
2. Copy the `service_role` key (keep this secret!)

---

## 2. Cloudflare R2 Setup

### Create Bucket

1. Log in to Cloudflare Dashboard
2. Go to R2 Object Storage
3. Create bucket: `webresume-uploads`
4. Note the bucket name

### Create API Token

1. Go to R2 > Manage R2 API Tokens
2. Create API Token with:
   - Permissions: Read & Write
   - Apply to: Specific bucket (webresume-uploads)
3. Copy:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL

### Configure CORS

1. Go to your R2 bucket settings
2. Add CORS policy:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-domain.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 3. Replicate Setup

1. Sign up at [replicate.com](https://replicate.com)
2. Go to Account > API Tokens
3. Create new token
4. Copy the API token

---

## 4. Environment Variables

### Development (.env.local)

Create `.env.local` in project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare R2
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=webresume-uploads

# Replicate
REPLICATE_API_TOKEN=your-replicate-token

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Production (Cloudflare Workers)

Set these in Cloudflare Dashboard (Workers & Pages > Your Worker > Settings > Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (encrypt)
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id (encrypt)
R2_SECRET_ACCESS_KEY=your-secret-access-key (encrypt)
R2_BUCKET_NAME=webresume-uploads
REPLICATE_API_TOKEN=your-replicate-token (encrypt)
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

---

## 5. Build & Deploy

### Install Dependencies

```bash
bun install
```

### Test Locally

```bash
bun run dev
```

Visit `http://localhost:3000` and test:
1. Upload a PDF resume
2. Log in with Google
3. Verify resume parsing
4. Check dashboard

### Build for Production

```bash
bun run build
```

Verify no errors. Expected output:
- TypeScript compilation: ✓
- ESLint: 1 warning (img element - acceptable)
- Static generation: 18/18 routes

### Generate OpenNext for Cloudflare

```bash
bunx opennextjs-cloudflare
```

This creates `.open-next` directory with Cloudflare Workers adapter.

### Deploy to Cloudflare Workers

#### Option 1: Wrangler CLI

```bash
bunx wrangler deploy
```

#### Option 2: Cloudflare Dashboard

1. Go to Workers & Pages
2. Create Application > Pages
3. Connect to Git (GitHub)
4. Build settings:
   - Build command: `bun run build && bunx opennextjs-cloudflare`
   - Build output directory: `.open-next/worker`
5. Add environment variables (see section 4)
6. Deploy

---

## 6. DNS Configuration

### Using Cloudflare DNS

1. Go to Cloudflare Dashboard > DNS
2. Add CNAME record:
   - Name: `@` (or subdomain like `app`)
   - Target: `your-worker.workers.dev`
   - Proxy: Enabled (orange cloud)

### Custom Domain

1. Go to Workers & Pages > Your Worker > Settings > Domains
2. Add custom domain
3. Follow DNS verification steps

---

## 7. Post-Deployment Verification

### Checklist

- [ ] Homepage loads
- [ ] Upload PDF works (presigned URL generates)
- [ ] R2 upload succeeds
- [ ] Google OAuth works
- [ ] Profile created in Supabase
- [ ] Resume parsing triggers
- [ ] Dashboard displays correctly
- [ ] Edit form saves changes
- [ ] Settings updates work
- [ ] Public profile renders (/{handle})
- [ ] Privacy filtering applies
- [ ] SEO metadata present

### Test Commands

```bash
# Check production build
curl https://your-domain.com

# Test API endpoint
curl https://your-domain.com/api/upload/sign \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","contentType":"application/pdf"}'
```

---

## 8. Monitoring Setup

### Cloudflare Analytics

1. Go to Workers & Pages > Your Worker > Analytics
2. Monitor:
   - Request rate
   - Error rate
   - CPU time
   - Response time

### Supabase Logs

1. Go to Supabase Dashboard > Logs
2. Monitor:
   - Database queries
   - Auth events
   - Errors

### Set Up Alerts (Optional)

1. Cloudflare Notifications:
   - High error rate alert
   - Unusual traffic patterns

2. Supabase Alerts:
   - High query latency
   - Failed auth attempts

---

## 9. Scaling Considerations

### Cloudflare Workers Limits

- **Free Plan**: 100,000 requests/day
- **Paid Plan**: Unlimited requests ($5/month + $0.50/million requests)
- **CPU Time**: 50ms per request (should be sufficient)

### Supabase Limits

- **Free Plan**: 500 MB database, 1 GB bandwidth
- **Pro Plan**: 8 GB database, 50 GB bandwidth ($25/month)

### R2 Storage Costs

- **Storage**: $0.015/GB/month
- **Operations**: Class A (writes) $4.50/million, Class B (reads) $0.36/million
- **Egress**: Free (unlike S3)

### Replicate Costs

- **Marker Model**: ~$0.005 per run (2-page PDF)
- Approximately $1 per 200 resumes parsed

---

## 10. Troubleshooting

### Build Fails

**Error**: TypeScript compilation errors

**Solution**: Run `bun run build` locally and fix all type errors

---

### OAuth Redirect Loop

**Error**: Infinite redirect after login

**Solution**:
1. Check `NEXT_PUBLIC_SUPABASE_URL` includes `https://`
2. Verify redirect URLs in Supabase match production domain
3. Clear browser cookies and try again

---

### R2 Upload Fails

**Error**: CORS error or 403 Forbidden

**Solution**:
1. Verify R2 CORS policy includes production domain
2. Check R2 API token permissions (Read & Write)
3. Ensure `R2_BUCKET_NAME` matches actual bucket name

---

### Parsing Timeout

**Error**: Resume stuck in "processing" status

**Solution**:
1. Check Replicate API token is valid
2. Verify PDF is valid (not corrupted)
3. Check Replicate dashboard for job status
4. Implement retry mechanism (already built-in)

---

### Rate Limit Not Working

**Error**: Users can upload more than 5 resumes/day

**Solution**:
1. Check database query in `/api/upload/sign` route
2. Verify user authentication is working
3. Test with same user account multiple times

---

## 11. Rollback Procedure

If deployment fails:

### Quick Rollback

```bash
# Rollback to previous deployment
bunx wrangler rollback
```

### Manual Rollback

1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your worker
3. Go to Deployments
4. Find previous working deployment
5. Click "..." > "Rollback to this deployment"

---

## 12. Continuous Deployment (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build

      - name: Deploy
        run: bunx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Add `CLOUDFLARE_API_TOKEN` to GitHub Secrets.

---

## 13. Security Checklist

- [ ] Service role key encrypted in Cloudflare
- [ ] R2 credentials encrypted
- [ ] Replicate API token encrypted
- [ ] CORS configured correctly (no wildcards)
- [ ] Supabase RLS policies enabled
- [ ] Rate limiting implemented
- [ ] Input validation on all forms
- [ ] No sensitive data in client-side code
- [ ] HTTPS enforced (Cloudflare proxy)

---

## 14. Performance Optimization

### Caching Strategy

```javascript
// In /{handle}/page.tsx
export const revalidate = 3600 // Cache for 1 hour
```

### Database Indexes

Already created in schema:
- `idx_resumes_user_id`
- `idx_resumes_status`
- `idx_site_data_user_id`

### R2 Lifecycle Policies (Optional)

Auto-delete temp uploads after 7 days:

1. Go to R2 bucket settings
2. Add lifecycle rule:
   - Prefix: `temp/`
   - Delete after: 7 days

---

## 15. Backup Strategy

### Supabase Backups

- **Free Plan**: Daily backups, 7-day retention
- **Pro Plan**: Daily backups, point-in-time recovery

### Manual Backup

```bash
# Backup database
bunx supabase db dump -f backup.sql

# Restore database
bunx supabase db push backup.sql
```

---

## Success!

Your webresume.now application is now deployed to production.

**Next Steps**:
1. Test all flows end-to-end on production
2. Set up monitoring and alerts
3. Share with beta users
4. Collect feedback and iterate

---

**Document Version**: 1.0
**Last Updated**: 2025-11-18
