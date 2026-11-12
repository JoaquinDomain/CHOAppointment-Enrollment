export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getPrivacyConfig } from '@/server/config/env'
import PrivacyPolicyLink from '@/components/PrivacyPolicyLink'
import {
  PUBLISHED_CHO_CONTACT_PHONE,
  PUBLISHED_PRIVACY_CONTACT_EMAIL,
  PUBLISHED_PRIVACY_OFFICER_NAME,
} from '@/constants/privacy'

export const metadata: Metadata = {
  title: 'Privacy Notice - CHO Laboratory Appointment System',
  description:
    'How the Bacolod City Health Office collects, uses, stores, and protects personal and health information submitted through the laboratory appointment system.',
}

export default function PrivacyPage() {
  const privacy = getPrivacyConfig()
  const consentVersion = process.env.CONSENT_VERSION?.trim() || 'v1'
  const officerName = privacy.officerName || PUBLISHED_PRIVACY_OFFICER_NAME
  const contactEmail = privacy.contactEmail || PUBLISHED_PRIVACY_CONTACT_EMAIL
  const contactPhone = privacy.contactPhone || PUBLISHED_CHO_CONTACT_PHONE

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
        City Health Office Â· Bacolod City
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Privacy Notice
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        This notice explains how the City Health Office (CHO) of Bacolod City processes
        personal and health information submitted through the laboratory appointment
        system, in accordance with Republic Act No. 10173, the Data Privacy Act of 2012,
        its implementing rules, and applicable City Government policies.
      </p>

      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">
        <strong className="font-bold">Official policy:</strong> the City Health Office
        publishes the authoritative Privacy Policy for this system on its official
        website. The summary below is a system implementation aid and does not replace
        the published policy.{' '}
        <PrivacyPolicyLink className="text-sm" />
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
        <strong className="font-bold">Important:</strong> this page is a system
        implementation summary. The published policy governs. CHO must keep the
        published policy and this summary aligned, and both must be reviewed and
        approved by its Data Protection Officer and legal counsel before public launch.
      </div>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            1. Information we collect
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Identification and contact details: name, birthdate, gender, civil status,
              address, phone number, and optional family information.
            </li>
            <li>
              Coverage and program information: PhilHealth number and category, YAKAP
              registration, primary care benefit membership, PWD status, and facility
              household number.
            </li>
            <li>
              Appointment details: selected service, facility, date, time slot, status,
              and booking reference.
            </li>
            <li>
              Consent records, including the consent version, timestamp, and a one-way hash
              of the network address used during submission.
            </li>
          </ul>
          <p className="mt-2">
            Please do not submit information that is not requested. The form does not ask
            for clinical results or diagnoses.
          </p>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            <strong className="font-bold">Known difference:</strong> the published policy
            states that the system does not collect a home address, a civil status, or a
            government or PhilHealth identification number. This application does collect
            the residential address, the civil status, and the PhilHealth number when the
            patient provides them, and the fields listed above reflect that. The City
            Health Office and its Data Protection Officer are reviewing the difference;
            the published policy governs in the meantime.
          </div>
        </section>

        <section>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            2. Why we process it
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>To record and manage your laboratory appointment and daily capacity.</li>
            <li>To verify your booking when you arrive and to coordinate service delivery.</li>
            <li>
              To maintain enrollment and consent records required by CHO, the Bacolod City
              Health Office, and the Integrated Clinic Information System
              (iClinicSys/YAKAP), where applicable.
            </li>
            <li>
              To protect the system through rate limiting, audit logs, and security
              monitoring.
            </li>
            <li>To comply with legal, regulatory, and public health obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            3. Who can access it
          </h2>
          <p className="mt-2">
            Access is limited to authorized CHO personnel and system administrators on a
            need-to-know basis. Appointment lists are not publicly available. QR codes
            contain only a signed reference, not your name or medical information. The
            system does not sell personal information or share it with advertisers.
          </p>
          <p className="mt-2">
            Every staff member signs in with an individual administrator account. All
            sign-in activity, status changes, and QR verifications are recorded in an
            audit trail with the requesting network address stored only as a one-way
            hash. Signed-in staff can view the appointment list, open individual patient
            records, update appointment status, and export the appointment list as a
            spreadsheet.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            4. Storage and retention
          </h2>
          <p className="mt-2">
            Records are stored in a controlled MySQL database operated for the City Health
            Office. Timestamps are recorded in UTC, while appointment dates follow Manila
            time. Access is protected by individual administrator accounts, password
            hashing, session expiry, and audit logging.
          </p>
          <p className="mt-2">
            The public pages set no cookies. Signing in to the administrator portal sets
            two cookies: the session cookie, which is HttpOnly so page scripts cannot read
            it, and a matching anti-cross-site-request-forgery token that the dashboard
            script must echo back in a request header. Both are scoped to the site, are
            sent over HTTPS only in production, and are removed when the session ends.
          </p>
          <p className="mt-2">
            {privacy.retentionSummary ||
              'CHO retains appointment and consent records only for as long as necessary for service delivery, legal, and audit obligations. The specific retention schedule is maintained by the CHO Records Officer and is subject to the National Archives of the Philippines rules and the Data Privacy Act.'}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            5. Your rights
          </h2>
          <p className="mt-2">Subject to legal exceptions, you have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Be informed about how your information is processed.</li>
            <li>Request access to your personal information held by CHO.</li>
            <li>Request correction of inaccurate or incomplete information.</li>
            <li>Object to processing or request blocking, erasure, or destruction.</li>
            <li>Withdraw consent, without affecting processing already lawfully carried out.</li>
            <li>File a complaint with the National Privacy Commission.</li>
            <li>Be indemnified for damages under applicable law.</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact the CHO Data Protection Officer. You may be
            asked to verify your identity before a request is processed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            6. Data Protection Officer
          </h2>
          <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">{officerName}</p>
            <p className="mt-1">
              Email:{' '}
              <a
                className="font-semibold text-emerald-700 hover:underline"
                href={`mailto:${contactEmail}`}
              >
                {contactEmail}
              </a>
            </p>
            <p className="mt-1">
              Telephone:{' '}
              <a
                className="font-semibold text-emerald-700 hover:underline"
                href={`tel:${contactPhone.replace(/[^\d+]/g, '')}`}
              >
                {contactPhone}
              </a>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              City Health Office, Bacolod City â€” {PUBLISHED_CHO_CONTACT_PHONE}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            7. Consent and changes
          </h2>
          <p className="mt-2">
            Your booking is submitted only after you accept the data privacy consent on the
            enrollment form. The accepted consent version is recorded as{' '}
            <span className="font-mono font-semibold">{consentVersion}</span>.
          </p>
          <p className="mt-2">
            CHO may update this notice when processes, laws, or systems change. Material
            changes will be communicated through this page and, where appropriate, through
            the consent presented before future bookings.
          </p>
        </section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700"
        >
          Back to booking
        </Link>
        <Link
          href="/admin/login"
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800"
        >
          Staff sign in
        </Link>
      </div>
    </div>
  )
}

