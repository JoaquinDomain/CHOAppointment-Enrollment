# Deployment Guide - CHO Appointment System

## Step 1: GitHub Repository Setup

### Create GitHub Repository
1. Go to [github.com](https://github.com) and sign in to your account
2. Click the "+" button in the top-right corner
3. Select "New repository"
4. Fill in the repository details:
   - **Repository name**: `cho-appointment-system`
   - **Description**: `CHO Laboratory Appointment Booking & Admin System for Bacolod City Health Office`
   - **Visibility**: Choose "Public" or "Private" based on your preference
   - **Initialize with**: Leave all options unchecked (we already have code)
5. Click "Create repository"

### Push Code to GitHub
After creating the repository, GitHub will show you commands to push your existing code. Run these commands in your project directory:

```bash
cd "C:\Users\JAY\Downloads\CHOAppoinment and enrollment form\cho-appointment-system"
git remote add origin https://github.com/YOUR_USERNAME/cho-appointment-system.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 2: Vercel Deployment

### Option A: Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in/log in
2. Click "Add New" → "Project"
3. Vercel will ask to import your GitHub repository
4. Select the `cho-appointment-system` repository
5. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### Add Environment Variables in Vercel
In the Vercel project settings, add these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
```

For Oracle DB (optional):
```
ORACLE_USER=your_oracle_user
ORACLE_PASSWORD=your_oracle_password
ORACLE_CONNECT_STRING=your_oracle_connection_string
```

6. Click "Deploy"
7. Wait for deployment to complete (usually 2-3 minutes)
8. Vercel will provide a live URL like `https://cho-appointment-system.vercel.app`

### Option B: Deploy via Vercel CLI

If you prefer using command line:

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
cd "C:\Users\JAY\Downloads\CHOAppoinment and enrollment form\cho-appointment-system"
vercel
```

4. Follow the prompts and add environment variables when asked

## Step 3: Supabase Setup

### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click "New Project"
3. Fill in project details:
   - **Name**: `cho-appointment-system`
   - **Database Password**: Generate a strong password
   - **Region**: Choose a region closest to your users
4. Wait for project to be created (2-3 minutes)

### Run Database Schema
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the contents of `docs/schema.sql` from your project
5. Paste it into the SQL editor
6. Click "Run" to execute the schema

### Get Supabase Credentials
1. In Supabase dashboard, go to "Settings" → "API"
2. Copy these values:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon/public key**: The long string under "Project API keys"

### Update Environment Variables
Add these to your Vercel project environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Your anon/public key

## Step 4: Update Production URLs

After Vercel deployment:
1. Get your Vercel URL (e.g., `https://cho-appointment-system.vercel.app`)
2. Update the `NEXT_PUBLIC_SITE_URL` environment variable in Vercel
3. Redeploy if needed (Vercel usually auto-deploys on env var changes)

## Step 5: Test the Deployment

1. Visit your Vercel URL
2. Test the patient booking flow:
   - Select a date and service
   - Fill in patient information
   - Submit appointment
   - Verify QR code generation
3. Test the admin dashboard:
   - Navigate to `/admin`
   - Verify patient records display
   - Test search and filter functionality
   - Test QR scanner (requires camera permission)

## Important Notes

### Security
- Never commit actual `.env.local` file to GitHub
- Use strong passwords for Supabase and Oracle DB
- Enable Supabase RLS policies (already in schema.sql)
- Consider adding authentication for admin dashboard in production

### Performance
- Vercel automatically handles CDN and caching
- Supabase provides free tier for small projects
- Monitor usage and upgrade plans as needed

### Custom Domain (Optional)
1. In Vercel project settings, go to "Domains"
2. Add your custom domain (e.g., `cho.bacolodcity.gov.ph`)
3. Configure DNS records as instructed by Vercel
4. Enable SSL certificate (automatic)

### Monitoring
- Vercel provides built-in analytics and logs
- Supabase dashboard shows database usage
- Set up error tracking (e.g., Sentry) for production

## Troubleshooting

### Build Errors
- Check environment variables are set correctly
- Verify all dependencies are installed
- Check Next.js and Supabase compatibility

### Database Connection Issues
- Verify Supabase URL and keys are correct
- Check Supabase project status
- Ensure RLS policies are properly configured

### QR Scanner Issues
- Camera permissions must be granted
- HTTPS is required for camera access (Vercel provides this)
- Test in modern browsers (Chrome, Firefox, Safari)

## Next Steps

After successful deployment:
1. Share the Vercel URL with CHO staff
2. Print QR posters for health stations
3. Train staff on using the admin dashboard
4. Monitor system performance and user feedback
5. Plan for regular backups and updates

## Support

For issues or questions:
- Vercel Documentation: https://vercel.com/docs
- Supabase Documentation: https://supabase.com/docs
- Next.js Documentation: https://nextjs.org/docs