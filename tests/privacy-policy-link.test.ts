import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  OFFICIAL_PRIVACY_POLICY_URL,
  PRIVACY_POLICY_LINK_LABEL,
} from '@/constants/privacy'

const EXPECTED_URL =
  'https://cho-laboratory-services-appointment.bacolodcity.gov.ph/privacy-policy'
const EXPECTED_LABEL = 'Read the Privacy Policy'

const REQUIRED_LOCATIONS = [
  { file: 'src/app/layout.tsx', name: 'public footer' },
  { file: 'src/components/AppointmentForm.tsx', name: 'patient booking form' },
  { file: 'src/components/EnrollmentModal.tsx', name: 'patient enrollment form' },
  // The administrator login route is split into a server wrapper and a client
  // component so that the route can be rendered dynamically and can receive a
  // per-request Content Security Policy nonce.
  { file: 'src/app/admin/login/AdminLoginClient.tsx', name: 'administrator login page' },
]

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('official privacy policy link', () => {
  it('points at the exact published policy URL', () => {
    expect(OFFICIAL_PRIVACY_POLICY_URL).toBe(EXPECTED_URL)
  })

  it('uses the exact required label', () => {
    expect(PRIVACY_POLICY_LINK_LABEL).toBe(EXPECTED_LABEL)
  })

  it('renders the link in every required location', () => {
    for (const location of REQUIRED_LOCATIONS) {
      const source = readSource(location.file)
      expect(source, `${location.name} (${location.file})`).toContain(
        'PrivacyPolicyLink'
      )
    }
  })

  it('never references a different privacy policy address', () => {
    const sources = [
      ...REQUIRED_LOCATIONS.map(location => location.file),
      'src/app/admin/login/page.tsx',
      'src/components/PrivacyPolicyLink.tsx',
      'src/app/privacy/page.tsx',
      'src/app/appointment/status/page.tsx',
    ]

    for (const file of sources) {
      const source = readSource(file)
      const urls =
        source.match(/https?:\/\/[^\s'"`)]*privacy[^\s'"`)]*/gi) ?? []
      for (const url of urls) {
        expect(url, `${file} references ${url}`).toBe(EXPECTED_URL)
      }
    }
  })

  it('opens the policy in a new tab safely and stays keyboard accessible', () => {
    const source = readSource('src/components/PrivacyPolicyLink.tsx')

    expect(source).toContain('target="_blank"')
    expect(source).toContain('rel="noopener noreferrer external"')
    expect(source).toContain('focus-visible:ring-2')
    expect(source).toContain('href={OFFICIAL_PRIVACY_POLICY_URL}')
    expect(source).toContain('{PRIVACY_POLICY_LINK_LABEL}')
  })

  it('keeps the enrollment link out of the printed record layout', () => {
    const source = readSource('src/components/EnrollmentModal.tsx')
    const consentIndex = source.indexOf('dataPrivacyConsent')
    const linkIndex = source.indexOf('<PrivacyPolicyLink')

    expect(consentIndex).toBeGreaterThan(-1)
    expect(linkIndex).toBeGreaterThan(consentIndex)
    expect(source.slice(consentIndex, linkIndex)).toContain('no-print')
  })

  it('does not add a second, competing consent checkbox', () => {
    const source = readSource('src/components/EnrollmentModal.tsx')
    const checkboxes = source.match(/<input[\s\S]*?type="checkbox"/g) ?? []
    const consentControls = source.match(/id="dataPrivacyConsent"/g) ?? []

    // The enrolment form already collects the pre-existing data privacy
    // consent. No additional consent control may be introduced.
    expect(checkboxes.length).toBe(5)
    expect(consentControls.length).toBe(1)
  })
})
