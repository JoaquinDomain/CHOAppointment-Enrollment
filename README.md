# CHO Laboratory Appointment Booking & Admin System

A comprehensive appointment booking system for the City Health Office (CHO) Bacolod, built with Next.js 14, Supabase, and Tailwind CSS.

## Build Status
✅ Latest build includes all TypeScript fixes and visibility improvements

## Features

### Patient Portal
- **Multi-step Appointment Booking**: Intuitive 3-step booking process
- **Date Selection**: Native date picker with weekend restrictions
- **Service Selection**: Choose from various health services with daily slot caps
- **Patient Information**: Comprehensive form with demographics and health facility selection
- **YAKAP Registration**: Conditional logic for YAKAP registered patients
- **Laboratory Tests**: Select multiple lab tests with fasting reminders
- **QR Code Confirmation**: Generate downloadable QR code for appointment verification
- **Patient Enrollment Record**: Complete enrollment form with print functionality

### Admin Dashboard
- **Patient Records Table**: View all appointments with detailed information
- **QR Scanner**: Built-in camera QR reader for quick patient lookup
- **Search & Filter**: Real-time search by name and filter by health facility
- **Statistics**: Dashboard stats showing total appointments, today's bookings, etc.
- **Export Functionality**: Export appointments to CSV
- **Site QR Poster**: Generate printable QR posters for health stations

### Technical Features
- **Row Level Security**: Supabase RLS policies for data protection
- **Weekend Validation**: Frontend and backend validation for weekend appointments
- **Oracle DB Integration**: Configurable Oracle database with mock fallback
- **Print-Ready Forms**: CSS print media queries for enrollment records
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS + Lucide Icons
- **Database & Auth**: Supabase PostgreSQL
- **QR Code**: qrcode.react (generation) & html5-qrcode (scanning)
- **Deployment**: Vercel

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account and project
- (Optional) Oracle database credentials

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

5. Set up the database:
   - Run the SQL script in `docs/schema.sql` in your Supabase SQL Editor
   - This creates the appointments table and RLS policies

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Schema

The system uses a single `appointments` table with the following structure:

- Patient demographics (name, age, address, contact info)
- Health facility information
- YAKAP registration status
- Service and appointment details
- Program coverage (PhilHealth, PWD, etc.)
- Consent and audit timestamps

See `docs/schema.sql` for the complete schema and RLS policies.

## Project Structure

```
cho-appointment-system/
├── src/
│   ├── app/
│   │   ├── admin/          # Admin dashboard page
│   │   ├── api/            # API routes
│   │   ├── layout.tsx      # Root layout with navigation
│   │   └── page.tsx        # Main appointment booking page
│   ├── components/
│   │   ├── AdminDashboard.tsx
│   │   ├── AppointmentForm.tsx
│   │   ├── DatePicker.tsx
│   │   ├── EnrollmentModal.tsx
│   │   ├── Navigation.tsx
│   │   ├── ServiceSelector.tsx
│   │   └── SiteQRPoster.tsx
│   └── lib/
│       ├── db/
│       │   └── oracle.ts   # Oracle DB integration
│       └── services/
│           └── appointmentService.ts
├── docs/
│   └── schema.sql          # Database schema
└── public/                 # Static assets
```

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

The project is configured for automatic Vercel deployments.

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon/public key
- `NEXT_PUBLIC_SITE_URL`: Your deployed site URL (for QR codes)
- `ORACLE_USER`: (Optional) Oracle database username
- `ORACLE_PASSWORD`: (Optional) Oracle database password
- `ORACLE_CONNECT_STRING`: (Optional) Oracle connection string

## Security

- **Row Level Security**: Supabase RLS policies ensure public users can only create appointments, while authenticated admins can view all records
- **Input Validation**: Frontend and backend validation for all form inputs
- **Weekend Restrictions**: Prevents booking on weekends at both frontend and backend levels
- **Data Privacy**: Explicit consent required for patient data processing

## Contributing

This is a municipal healthcare system. For contributions or issues, please contact the CHO Bacolod IT department.

## License

© 2024 City Health Office Bacolod. All rights reserved.