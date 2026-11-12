/**
 * Single source of truth for the official City Health Office privacy policy.
 *
 * The policy is published and maintained on the City Health Office website,
 * outside this application. The application only links to it; it never
 * mirrors, redirects, or re-hosts the policy content.
 */
export const OFFICIAL_PRIVACY_POLICY_URL =
  'https://cho-laboratory-services-appointment.bacolodcity.gov.ph/privacy-policy'

/** Exact wording required for every privacy policy link in the interface. */
export const PRIVACY_POLICY_LINK_LABEL = 'Read the Privacy Policy'

/**
 * Data Protection Officer contact details published in section 13 of the
 * official policy. These are used as the fallback when the deployment has not
 * supplied its own values through the `NEXT_PUBLIC_PRIVACY_*` environment
 * variables.
 */
export const PUBLISHED_PRIVACY_OFFICER_NAME =
  'Atty. Karol Joseph Chiu, Data Protection Officer, City Government of Bacolod'
export const PUBLISHED_PRIVACY_CONTACT_EMAIL = 'dataprotectionofficer@bacolodcity.gov.ph'
export const PUBLISHED_CHO_CONTACT_PHONE = '+63 34 431 3673'
