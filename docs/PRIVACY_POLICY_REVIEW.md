# Privacy Policy Accuracy Review

**Application:** CHO Laboratory Appointment & Enrollment System (`CHOAppointment-Enrollment`)
**Policy reviewed:** <https://cho-laboratory-services-appointment.bacolodcity.gov.ph/privacy-policy>
  (published by the City Health Office; effective 13 September 2026, last updated 14 October 2026)
**Prepared for:** City Health Office (CHO) and the City Government Data Protection Officer

This document compares the personal information the application actually collects, stores,
displays, and exports with the personal information the published policy says it collects. It
does **not** assert that the policy is compliant, and it does not assert that the application
complies with the Data Privacy Act. Those determinations remain with the CHO and the
authorised privacy personnel.

Nothing in this review has been implemented unilaterally. No retention period, certification,
encryption practice, backup procedure, or legal approval has been invented or assumed, and no
additional consent control was added to make the application appear compliant.

---

## 1. Summary

| # | Finding | Direction | Label |
| --- | --- | --- | --- |
| F1 | The application collects a home address, civil status, and a PhilHealth number. The policy states the system does not collect these. | Application collects more than the policy describes | `NEEDS OFFICIAL REVIEW` |
| F2 | The application collects further identity and coverage fields that the policy's collection list does not mention. | Application collects more than the policy describes | `NEEDS OFFICIAL REVIEW` |
| F3 | The policy states the booking form uses Cloudflare Turnstile. The control was absent; it is now implemented but disabled by default. | Policy claims a safeguard that was not active | `NEEDS CONFIGURATION` |
| F4 | The policy states staff sign in with an e-mail address. The application uses a username. | Policy describes a different system | `NEEDS OFFICIAL REVIEW` |
| F5 | The policy states there is a single staff access level and that staff can delete appointment records. The application has two roles and no delete operation. | Policy describes features that do not exist | `NEEDS OFFICIAL REVIEW` |
| F6 | The policy states the session cookie is the only cookie set. The application also sets a CSRF cookie. | Application sets an undeclared cookie | `NEEDS OFFICIAL REVIEW` |
| F7 | The policy states rate-limit counters are held in server memory. They are persisted in MySQL. | Policy describes a different storage model | `NEEDS OFFICIAL REVIEW` |
| F8 | The policy describes walk-in registration, a check-in time, and a browser session-storage marker. None of these exist in this application. | Policy describes features that do not exist | `NEEDS OFFICIAL REVIEW` |
| F9 | The policy states processing is based on the CHO's legal mandate and that specific consent "will be sought separately", while the application makes a consent checkbox mandatory before a booking can be submitted. | Lawful-basis tension | `NEEDS OFFICIAL REVIEW` |
| F10 | The policy names a data controller, a service office, a Data Protection Officer, and a National Privacy Commission route, but gives no retention schedule, no hosting identification, and no third-party processing register beyond Turnstile. | Policy is incomplete for the actual processing | `NEEDS OFFICIAL REVIEW` |
| F11 | The application's own in-app notice and the published policy now disagree about the same fields. | Two notices in conflict | `NEEDS OFFICIAL REVIEW` |

---

## 2. What the application actually collects

Every field below reaches the server through `POST /api/appointments`, is validated in
`src/server/appointments/appointment.validation.ts`, and is written by
`src/server/appointments/mysql-appointments.ts`.

### 2.1 Identity and contact — stored in `patients`

| Field | Source column | Required | Sensitive? |
| --- | --- | --- | --- |
| First, middle, last name, suffix | `first_name`, `middle_name`, `last_name`, `suffix` | First and last yes | Identifying |
| Full name | `full_name` | Yes | Identifying |
| Date of birth | `birthdate` | Yes | **Sensitive** — combined with the name it is a strong identifier |
| Gender | `gender` | Yes | — |
| Civil status | `civil_status` | No | — |
| Residential address | `residential_address` | **Yes** | **Sensitive** — a home address |
| Contact number | `contact_number` | Yes | **Sensitive** — a personal contact number |
| Spouse name | `spouse_name` | No | **Sensitive** — information about a third party |
| Mother's maiden name | `mothers_maiden_name` | No | **Sensitive** — information about a third party |
| Employment status | `employment_status` | No | — |

### 2.2 Programme and coverage — stored in `patients`

| Field | Source column | Required | Sensitive? |
| --- | --- | --- | --- |
| Primary care benefit membership | `primary_care_benefit_member` | No | **Sensitive** — reveals a health-programme enrolment |
| YAKAP registration and facility | `yakap_registered`, `yakap_facility` | Facility required if registered | **Sensitive** |
| PhilHealth membership, number, status | `philhealth_member`, `philhealth_number`, `philhealth_status` | Number and status required if a member | **Sensitive** — a government identifier |
| PWD status | `pwd` | No | **Sensitive** — disability status |
| Facility household number | `facility_household_number` | No | **Sensitive** — links a person to a household |

### 2.3 Appointment — stored in `appointments`

Service requested, consulting facility, appointment date, AM/PM time slot, status, and an
internal record identifier. The service requested, the date of birth, the YAKAP status, and
the facility are the fields the policy already treats as sensitive personal information.

### 2.4 Technical and consent data — stored in `consent_records` and `audit_logs`

| Field | Storage | Note |
| --- | --- | --- |
| Consent version and acceptance timestamp | `consent_records` | `CONSENT_VERSION`, e.g. `v1` |
| SHA-256 hash of the submitting IP address | `consent_records.ip_hash` | One-way; the address itself is not stored |
| User agent string | `consent_records.user_agent`, `admin_sessions.user_agent`, `audit_logs.user_agent` | Truncated to 255 characters |
| Request identifier | `audit_logs.request_id` | For correlation |
| Administrator account identifier and action | `audit_logs` | Who signed in, viewed, scanned, or changed a record |
| One-way hash of the administrator's IP address | `audit_logs.ip_hash` | — |
| Rate-limit counters | `rate_limit_buckets` | SHA-256 hashed identifiers, no raw addresses |

### 2.5 Not collected

The application does **not** collect an e-mail address, a barangay as a separate field,
payment details, medical records, diagnoses, prescriptions, or laboratory results.

The printable Patient Enrollment Record / Individual Treatment Record contains a print-only
clinical information block — chief complaint, vital signs, a SOAP note, and diagnosis lines.
That block is **never transmitted to the application**; it is rendered on paper and completed
by hand by staff. This should still be confirmed in the policy, because the printed sheet is
a record of the personal information controller even though the application never receives it.

---

## 3. What the published policy says

The policy's section 2 lists the following as the information collected when booking an
appointment:

> Full name (last name, first name, middle name, if any) · Date of birth (your age is derived
> from it) · Contact number · Health facility where you were consulted · PhilHealth YAKAP
> registration status and, if registered, the YAKAP facility · Laboratory tests you are
> requesting · Your preferred appointment date

It then states explicitly:

> The system does not collect an e-mail address, home address, barangay, civil status,
> government or PhilHealth ID number, medical records, or the results of any laboratory test.
> It does not ask for payment details.

Its section 3 treats as sensitive: the laboratory tests requested, together with the date of
birth, YAKAP status, and the consulting facility.

Its section 6 states:

> Every staff member signs in with an individual account protected by a hashed password and an
> expiring, httpOnly session cookie … The application has a single staff access level: any
> signed-in staff member can view, edit, correct, check in, export, and delete appointment
> records.

Its section 8 states:

> The only cookie it sets is the staff sign-in session cookie … The page also keeps a small
> technical marker in your browser's session storage so that it can recover once from a script
> that fails to load …

Its section 9 states:

> The public booking form uses one external service: Cloudflare Turnstile …

Its section 10 states:

> The application itself has no automated job that purges records: appointment records are
> removed only when authorized staff delete them through the staff dashboard. Technical
> sign-in session records are deleted automatically when they expire or when a staff member
> signs out, and rate-limit counters are held only in the server's memory and cleared when it
> restarts.

Its section 4 states that processing rests on the CHO's legal mandate and compliance with a
legal obligation, "rather than on your consent alone", and that "where a specific consent is
later determined to be required, it will be sought separately".

---

## 4. Field-by-field comparison

### 4.1 Collected by the application but not described by the policy

| Field | Policy position | What the policy does not say |
| --- | --- | --- |
| Residential address | Explicitly excluded ("does not collect … home address") | That it is **mandatory**, that it is stored in clear text in `patients.residential_address`, that it is shown to every signed-in administrator, and that it is excluded from the CSV export |
| Civil status | Explicitly excluded | That it is collected (Single, Married, Widowed, Separated) and stored |
| Gender | Not listed | That it is collected and stored |
| Spouse name | Not listed | That it is collected and stored |
| Mother's maiden name | Not listed | That it is collected and stored; that it concerns a third party who has not consented |
| Employment status | Not listed | That it is collected and stored |
| PhilHealth number | Explicitly excluded ("government or PhilHealth ID number") | That a twelve-digit PhilHealth PIN is collected when the patient is a member, and stored |
| PhilHealth status (member / dependent) | Not listed | That it is collected and stored |
| Facility household number | Not listed | That it is collected and stored; that it links a patient to a household |
| Primary care benefit membership | Not listed | That it is collected and stored |
| PWD status | Not listed | That it is collected and stored; that disability status is sensitive personal information |
| Appointment time slot (AM/PM) | Not listed | That it is collected and stored |
| Consent version, acceptance timestamp | Only referred to indirectly | The specific fields stored in `consent_records` and their purpose |
| Hashed submitting IP address and user agent | "your IP address … is not written into your appointment record" | That a one-way hash of the address and the user agent are stored in `consent_records` and `audit_logs` |
| Administrator audit trail | Not described | That `audit_logs` records which administrator viewed or changed which appointment, with a hashed address |
| Rate-limit counters in the database | Contradicted ("held only in the server's memory") | That counters are persisted in the `rate_limit_buckets` table with SHA-256 hashed identifiers |

### 4.2 Described by the policy but not present in the application

| Policy statement | Application reality |
| --- | --- |
| "staff register walk-in patients" | No walk-in registration. The `appointments` table has no walk-in flag and the administrator dashboard has no walk-in entry. |
| "the time you checked in" | No check-in time is stored. A QR scan writes an audit entry and shows the record; it does not record a check-in timestamp on the appointment. |
| "whether it was booked online or registered as a walk-in" | Not stored. All appointments are created through the same online endpoint. |
| "the staff member's e-mail address is also recorded when they block a laboratory date" | Administrators have a username, not an e-mail address. There is no "block a laboratory date" feature. |
| "The application has a single staff access level" | Two roles exist in the schema, `admin` and `superadmin`, and the session carries the role. There is no feature that currently distinguishes them, but the policy statement is inaccurate. |
| "any signed-in staff member can … delete appointment records" | There is no delete operation. A record can only be moved to the `cancelled` status, which releases the capacity slot but keeps every field. |
| "a small technical marker in your browser's session storage" | The application does not use `sessionStorage` or `localStorage` at all. |
| "The only cookie it sets is the staff sign-in session cookie" | The application sets a session cookie **and** a CSRF cookie (`__Host-cho_csrf` in production, `cho_csrf` otherwise). The CSRF cookie is not HttpOnly because the dashboard script must echo it in a request header; it holds a random, single-purpose token and no personal information. |
| "rate-limit counters are held only in the server's memory" | Counters are stored in the `rate_limit_buckets` MySQL table. |
| "Human verification (Cloudflare Turnstile) on public booking" | Was not implemented at all. It is now implemented and verified server-side, but **disabled by default**; it takes effect only once `TURNSTILE_ENABLED=true` and both Cloudflare keys are supplied. |
| "The system does not collect an e-mail address" | Correct — the application collects no e-mail address. This statement remains accurate. |
| "it does not store test results, diagnoses, prescriptions, or other medical records" | Correct for the application. The **printed** ITR sheet has print-only clinical fields completed by hand, which the policy does not mention. |
| "Records are stored in a MySQL database … on a server managed in coordination with the City's information technology personnel" | Accurate. The policy does not identify the hosting arrangement (for example Vercel) or whether any production data leaves City-controlled infrastructure, which the DPO may want to record. |
| "The typeface used on this site (Inter) is downloaded when the site is built" | Accurate — `next/font/google` self-hosts the font at build time; the browser contacts no font service. |

### 4.3 Requirements the policy lists that the application can meet but does not yet evidence

The policy grants data subjects the right to have data "erased or blocked where the law
provides", and says that erasure happens "only when authorized staff delete them through the
staff dashboard". Because the dashboard has no delete operation, a correctly submitted erasure
request cannot currently be executed through the system. This is a genuine gap between the
published rights and the implemented capability, and it is the most consequential mismatch in
this review, because it concerns a right the policy already grants.

---

## 5. Required policy updates for CHO and DPO review

The following items must be decided by the CHO and the DPO. Each is stated as a question with
the application facts that inform it. **None has been implemented in the policy or in the
application, because each is a governance decision.**

### 5.1 Correct the statement about what is collected

1. **Decide whether the home address stays mandatory.** It is currently a required field with
   a five-character minimum, and it is the single largest divergence from the policy. Either
   the policy must be amended to disclose the residential address, the facility household
   number, and the civil status as collected data, or the form must be changed to make the
   address optional. The DPO should weigh whether a residential address is necessary for a
   laboratory appointment, and note that it is not currently used for capacity management,
   service delivery, or reminders.
2. **Decide whether the PhilHealth number stays in the form.** A twelve-digit PIN is
   collected whenever the patient answers "yes" to PhilHealth membership, and it is stored in
   clear text. If the value is not needed operationally, removing it from the form is the
   simplest way to close the largest gap in the policy. If it is needed, the policy must
   disclose its collection, storage, and access.
3. **Amend the collection list in section 2** so that it enumerates the remaining fields:
   gender, spouse name, mother's maiden name, employment status, primary care benefit
   membership, PWD status, PhilHealth status, facility household number, the AM/PM slot, the
   consent version and timestamp, the hashed address, the user agent, and the administrator
   audit trail.
4. **Extend the sensitive personal information list in section 3** beyond the tests, date of
   birth, YAKAP status, and facility. It should at minimum address the residential address,
   the PhilHealth number, PWD status, primary care benefit and YAKAP membership, the household
   number, the mother's maiden name, and the spouse name, and should record the Section 13
   condition relied on for each.
5. **Record that the mother's maiden name and spouse name concern third parties** who have
   not themselves consented, and state the condition relied on for processing them.

### 5.2 Correct the statement about the safeguards

6. **Decide the Turnstile position.** Either supply Cloudflare credentials, set
   `TURNSTILE_ENABLED=true` with both keys, and rebuild, so that the section 7 and section 9
   claims become true; or amend those sections to state that automated submissions are
   controlled by rate limiting rather than human verification. The policy currently states as
   fact something that is not active.
7. **Correct the cookie description in section 8** to disclose the CSRF cookie, its purpose,
   its `Secure` and `SameSite` attributes, and that it holds no personal information.
8. **Remove or correct the session-storage sentence in section 8.** The application keeps no
   browser-side marker.
9. **Correct the rate-limit statement in section 10** to describe the `rate_limit_buckets`
   table, the hashed identifiers, and the retention window.
10. **Correct the staff access statement in section 6.** Describe the two roles, the absence
    of a delete operation, and the fact that a cancelled record is retained with all of its
    fields. If the policy intends to promise deletion, a governed deletion capability must be
    specified and approved first.
11. **Correct the staff credential description.** The system uses a username, not an e-mail
    address, and there is no "block a laboratory date" feature.
12. **Confirm the walk-in and check-in statements.** If walk-in registration and check-in
    times are planned, they are not yet implemented and the policy should either be
    prospective or the features should be scheduled. If they belong to a different application
    operated by the CHO, the policy should say so.

### 5.3 Complete the governance gaps

13. **Publish a retention schedule** for appointment records, patient records, consent
    records, audit logs, session records, and rate-limit counters. The policy currently
    states that none has been published, which leaves the retention duty in section 10
    unsatisfied and the erasure right in section 12 unfulfillable.
14. **Identify the hosting arrangement and register it.** If any part of the production stack
    sits with a third-party host, that host is a processor and the policy's section 9 should
    name it, describe what it receives, and reference the appropriate agreement.
15. **Describe the audit trail** in the policy: what `audit_logs` records, how long it is
    kept, and who may read it.
16. **Document the lawful basis for the consent checkbox.** Section 4 states that processing
    is not based on consent, while the application requires a consent checkbox before it will
    accept a booking. Either the policy should describe the consent that is collected (and
    what it covers, given it is a general consent to encode information rather than a
    specific consent to a processing activity), or the DPO should confirm the existing consent
    is a corroborating record rather than the basis of processing.
17. **Describe the spreadsheet export** as a copy of patient data that leaves the system, and
    confirm the City rules that govern it. The policy mentions this in section 6 but does not
    specify the columns exported; the application deliberately excludes the address, contact
    number, PhilHealth number, and household number from the export, and that minimisation is
    worth recording.

### 5.4 Keep the in-app notice aligned

18. **The application contains its own notice at `/privacy`.** It has been changed to state
    that the published policy is authoritative and to link to it, but it still contains
    implementation detail that a reader could mistake for a policy. The DPO should either
    approve the in-app text or replace the page with a short pointer to the published policy.
    The in-app text currently reflects the application's actual behaviour, which the published
    policy does not yet do — resolving the two is what closes F1, F2, and F11.

---

## 6. What was deliberately not done

* No mandatory consent checkbox was added, and the existing one was not removed or reworded.
  Reading the privacy policy link is not treated as consent, and the link is a plain
  navigation link in every location.
* No retention period, encryption practice, backup schedule, security certification, legal
  approval, or organisational policy was invented. Where the published policy is silent, this
  review records the silence as an open item.
* No fake privacy policy page was created and no link redirects anywhere other than the
  official published address.
* The external privacy policy website was not modified.
* No database was migrated, and no field was added, removed, or reclassified in the schema.
