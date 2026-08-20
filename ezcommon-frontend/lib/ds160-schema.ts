import {
  COUNTRY_OPTIONS,
  isProfileSectionComplete,
  type FieldDef,
  type FieldGroup,
  type NestedRepeatable,
  type ProfileSectionDef,
  type ProfileSectionMeta,
} from '@/lib/profile-schema'

// Re-exported so callers of this module don't need to also import from profile-schema.ts.
export { isProfileSectionComplete }
export type { FieldDef, FieldGroup, NestedRepeatable, ProfileSectionDef }
export type Ds160SectionMeta = ProfileSectionMeta

const YES_NO = ['Yes', 'No']
const SEX_OPTIONS = ['Male', 'Female']
const MARITAL_STATUS_OPTIONS = [
  'Married', 'Common Law Marriage', 'Civil Union/Domestic Partnership', 'Single', 'Widowed', 'Divorced', 'Legally Separated', 'Other',
]
// Scoped to the two demo visa classes per the user's request - the real DS-160 has many more.
const TRIP_PURPOSE_CLASS_OPTIONS = ['TEMP. BUSINESS OR PLEASURE VISITOR (B)', 'ACADEMIC OR LANGUAGE STUDENT (F)']
const TRIP_PURPOSE_SPECIFY_OPTIONS = ['TOURISM/MEDICAL TREATMENT (B2)', 'STUDENT (F1)']
const PAYER_OPTIONS = ['Self', 'Other Person', 'Employer', 'Educational Institution', 'Other']
const RELATIONSHIP_OPTIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Relative', 'Friend', 'Colleague', 'Employer', 'School Official', 'Other']
const SOCIAL_MEDIA_PLATFORM_OPTIONS = ['Facebook', 'Instagram', 'Twitter/X', 'LinkedIn', 'YouTube', 'TikTok', 'WeChat', 'Weibo', 'Other']
const PASSPORT_TYPE_OPTIONS = ['Regular', 'Official', 'Diplomatic', 'Laissez-Passer', 'Other']
const OCCUPATION_OPTIONS = ['Student', 'Employed', 'Self-Employed', 'Unemployed', 'Retired', 'Other']
const SECURITY_QUESTION_OPTIONS = [
  "What is your mother's maiden name?", 'What was the name of your first pet?', 'What was your childhood nickname?', 'What is the name of your favorite teacher?',
]

/**
 * Real DS-160 field labels/options/page structure, transcribed from the
 * actual ceac.state.gov/genniv/ form (pasted in full by the user in chat).
 * This is not a paraphrase - it's a demo product, but since this drives a
 * real government form's worth of data, accuracy matters more than for a
 * typical "representative subset". Scoped to two visa classes for the demo:
 * B1/B2 (Temp Business/Pleasure) and F1 (Student) - the SEVIS Information
 * and Additional Point of Contact pages are F1-only in the real form, and
 * the workspace (not this schema) hides them from the sidebar unless an F1
 * trip purpose has been selected. No conditional field visibility beyond
 * that one case - matches this app's established "fields always shown, no
 * field-level branching" precedent from the Profile schema.
 */
export const DS160_SECTIONS: Ds160SectionMeta[] = [
  {
    key: 'setup',
    labelKey: 'ds160.sections.setup',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'ds160.setup.description',
          fields: [
            { key: 'consulate', labelKey: 'ds160.setup.consulate', type: 'select', required: true, options: ['Beijing', 'Guangzhou', 'Shanghai', 'Wuhan', 'Shenyang', 'Other'] },
            { key: 'applicationId', labelKey: 'ds160.setup.applicationId', type: 'text', placeholderKey: 'ds160.setup.applicationIdPlaceholder' },
            { key: 'securityQuestion', labelKey: 'ds160.setup.securityQuestion', type: 'select', options: SECURITY_QUESTION_OPTIONS },
            { key: 'securityAnswer', labelKey: 'ds160.setup.securityAnswer', type: 'text' },
          ],
        },
      ],
    },
  },
  {
    key: 'personal1',
    labelKey: 'ds160.sections.personal1',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'ds160.personal1.description',
          fields: [
            { key: 'surnames', labelKey: 'ds160.personal1.surnames', type: 'text', required: true, placeholderKey: 'ds160.personal1.surnamesPlaceholder' },
            { key: 'givenNames', labelKey: 'ds160.personal1.givenNames', type: 'text', required: true, placeholderKey: 'ds160.personal1.givenNamesPlaceholder' },
            { key: 'fullNameNativeAlphabet', labelKey: 'ds160.personal1.fullNameNativeAlphabet', type: 'text' },
            { key: 'hasOtherNames', labelKey: 'ds160.personal1.hasOtherNames', type: 'radio', required: true, options: YES_NO },
            { key: 'hasTelecode', labelKey: 'ds160.personal1.hasTelecode', type: 'radio', required: true, options: YES_NO },
            { key: 'sex', labelKey: 'ds160.personal1.sex', type: 'select', required: true, options: SEX_OPTIONS },
            { key: 'maritalStatus', labelKey: 'ds160.personal1.maritalStatus', type: 'select', required: true, options: MARITAL_STATUS_OPTIONS },
            { key: 'dob', labelKey: 'ds160.personal1.dob', type: 'date', required: true },
            { key: 'birthCity', labelKey: 'ds160.personal1.birthCity', type: 'text', required: true },
            { key: 'birthState', labelKey: 'ds160.personal1.birthState', type: 'text' },
            { key: 'birthCountry', labelKey: 'ds160.personal1.birthCountry', type: 'select', required: true, options: COUNTRY_OPTIONS },
            { key: 'nationality', labelKey: 'ds160.personal1.nationality', type: 'select', required: true, options: COUNTRY_OPTIONS },
            { key: 'hasOtherNationality', labelKey: 'ds160.personal1.hasOtherNationality', type: 'radio', required: true, options: YES_NO },
            { key: 'isPermanentResidentElsewhere', labelKey: 'ds160.personal1.isPermanentResidentElsewhere', type: 'radio', required: true, options: YES_NO },
            { key: 'nationalIdNumber', labelKey: 'ds160.personal1.nationalIdNumber', type: 'text' },
            { key: 'usSSN', labelKey: 'ds160.personal1.usSSN', type: 'text' },
            { key: 'usTaxpayerId', labelKey: 'ds160.personal1.usTaxpayerId', type: 'text' },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'otherNames',
          labelKey: 'ds160.personal1.otherNamesLabel',
          itemLabelKey: 'ds160.personal1.addOtherName',
          emptyLabelKey: 'ds160.personal1.noOtherNames',
          fields: [
            { key: 'surname', labelKey: 'ds160.personal1.otherNameSurname', type: 'text' },
            { key: 'givenNames', labelKey: 'ds160.personal1.otherNameGivenNames', type: 'text' },
          ],
        },
        {
          key: 'otherNationalities',
          labelKey: 'ds160.personal1.otherNationalitiesLabel',
          itemLabelKey: 'ds160.personal1.addOtherNationality',
          emptyLabelKey: 'ds160.personal1.noOtherNationalities',
          fields: [{ key: 'country', labelKey: 'ds160.personal1.otherNationalityCountry', type: 'select', options: COUNTRY_OPTIONS }],
        },
      ],
    },
  },
  {
    key: 'travel',
    labelKey: 'ds160.sections.travel',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'hasSpecificPlans', labelKey: 'ds160.travel.hasSpecificPlans', type: 'radio', required: true, options: YES_NO },
            { key: 'arrivalDate', labelKey: 'ds160.travel.arrivalDate', type: 'date' },
            { key: 'arrivalFlight', labelKey: 'ds160.travel.arrivalFlight', type: 'text' },
            { key: 'arrivalCity', labelKey: 'ds160.travel.arrivalCity', type: 'text' },
            { key: 'departureDate', labelKey: 'ds160.travel.departureDate', type: 'date' },
            { key: 'departureFlight', labelKey: 'ds160.travel.departureFlight', type: 'text' },
            { key: 'departureCity', labelKey: 'ds160.travel.departureCity', type: 'text' },
            { key: 'stayStreetAddress1', labelKey: 'ds160.travel.stayStreetAddress1', type: 'text' },
            { key: 'stayStreetAddress2', labelKey: 'ds160.travel.stayStreetAddress2', type: 'text' },
            { key: 'stayCity', labelKey: 'ds160.travel.stayCity', type: 'text' },
            { key: 'stayState', labelKey: 'ds160.travel.stayState', type: 'text' },
            { key: 'stayZip', labelKey: 'ds160.travel.stayZip', type: 'text' },
            { key: 'payer', labelKey: 'ds160.travel.payer', type: 'select', options: PAYER_OPTIONS },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'tripPurposes',
          labelKey: 'ds160.travel.tripPurposesLabel',
          itemLabelKey: 'ds160.travel.addTripPurpose',
          emptyLabelKey: 'ds160.travel.noTripPurposes',
          fields: [
            { key: 'purposeClass', labelKey: 'ds160.travel.purposeClass', type: 'select', options: TRIP_PURPOSE_CLASS_OPTIONS },
            { key: 'specify', labelKey: 'ds160.travel.specify', type: 'select', options: TRIP_PURPOSE_SPECIFY_OPTIONS },
          ],
        },
        {
          key: 'locationsToVisit',
          labelKey: 'ds160.travel.locationsToVisitLabel',
          itemLabelKey: 'ds160.travel.addLocation',
          emptyLabelKey: 'ds160.travel.noLocations',
          fields: [{ key: 'location', labelKey: 'ds160.travel.location', type: 'text' }],
        },
      ],
    },
  },
  {
    key: 'companions',
    labelKey: 'ds160.sections.companions',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'hasCompanions', labelKey: 'ds160.companions.hasCompanions', type: 'radio', required: true, options: YES_NO },
            { key: 'travelingAsGroup', labelKey: 'ds160.companions.travelingAsGroup', type: 'radio', options: YES_NO },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'people',
          labelKey: 'ds160.companions.peopleLabel',
          itemLabelKey: 'ds160.companions.addPerson',
          emptyLabelKey: 'ds160.companions.noPeople',
          fields: [
            { key: 'surname', labelKey: 'ds160.companions.surname', type: 'text' },
            { key: 'givenNames', labelKey: 'ds160.companions.givenNames', type: 'text' },
            { key: 'relationship', labelKey: 'ds160.companions.relationship', type: 'select', options: RELATIONSHIP_OPTIONS },
          ],
        },
      ],
    },
  },
  {
    key: 'previousTravel',
    labelKey: 'ds160.sections.previousTravel',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'hasBeenToUS', labelKey: 'ds160.previousTravel.hasBeenToUS', type: 'radio', required: true, options: YES_NO },
            { key: 'hasDriversLicense', labelKey: 'ds160.previousTravel.hasDriversLicense', type: 'radio', options: YES_NO },
            { key: 'hasPriorVisa', labelKey: 'ds160.previousTravel.hasPriorVisa', type: 'radio', required: true, options: YES_NO },
            { key: 'lastVisaDate', labelKey: 'ds160.previousTravel.lastVisaDate', type: 'date' },
            { key: 'visaNumber', labelKey: 'ds160.previousTravel.visaNumber', type: 'text' },
            { key: 'sameVisaType', labelKey: 'ds160.previousTravel.sameVisaType', type: 'radio', options: YES_NO },
            { key: 'sameCountryAsBefore', labelKey: 'ds160.previousTravel.sameCountryAsBefore', type: 'radio', options: YES_NO },
            { key: 'tenPrinted', labelKey: 'ds160.previousTravel.tenPrinted', type: 'radio', options: YES_NO },
            { key: 'visaLostOrStolen', labelKey: 'ds160.previousTravel.visaLostOrStolen', type: 'radio', options: YES_NO },
            { key: 'visaCancelledOrRevoked', labelKey: 'ds160.previousTravel.visaCancelledOrRevoked', type: 'radio', options: YES_NO },
            { key: 'refusedVisaOrAdmission', labelKey: 'ds160.previousTravel.refusedVisaOrAdmission', type: 'radio', required: true, options: YES_NO },
            { key: 'refusedVisaExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'immigrantPetitionFiled', labelKey: 'ds160.previousTravel.immigrantPetitionFiled', type: 'radio', required: true, options: YES_NO },
            { key: 'immigrantPetitionExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'priorVisits',
          labelKey: 'ds160.previousTravel.priorVisitsLabel',
          itemLabelKey: 'ds160.previousTravel.addPriorVisit',
          emptyLabelKey: 'ds160.previousTravel.noPriorVisits',
          maxItems: 5,
          fields: [
            { key: 'dateArrived', labelKey: 'ds160.previousTravel.dateArrived', type: 'date' },
            { key: 'lengthOfStay', labelKey: 'ds160.previousTravel.lengthOfStay', type: 'text' },
          ],
        },
      ],
    },
  },
  {
    key: 'addressPhone',
    labelKey: 'ds160.sections.addressPhone',
    def: {
      kind: 'simple',
      groups: [
        {
          eyebrowKey: 'ds160.addressPhone.homeEyebrow',
          fields: [
            { key: 'homeStreetAddress1', labelKey: 'ds160.addressPhone.streetAddress1', type: 'text', required: true },
            { key: 'homeStreetAddress2', labelKey: 'ds160.addressPhone.streetAddress2', type: 'text' },
            { key: 'homeCity', labelKey: 'ds160.addressPhone.city', type: 'text', required: true },
            { key: 'homeStateProvince', labelKey: 'ds160.addressPhone.stateProvince', type: 'text' },
            { key: 'homePostalCode', labelKey: 'ds160.addressPhone.postalCode', type: 'text' },
            { key: 'homeCountry', labelKey: 'ds160.addressPhone.country', type: 'select', required: true, options: COUNTRY_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'ds160.addressPhone.mailingEyebrow',
          fields: [{ key: 'mailingSameAsHome', labelKey: 'ds160.addressPhone.mailingSameAsHome', type: 'radio', required: true, options: YES_NO }],
        },
        {
          eyebrowKey: 'ds160.addressPhone.phoneEyebrow',
          fields: [
            { key: 'primaryPhone', labelKey: 'ds160.addressPhone.primaryPhone', type: 'text', required: true },
            { key: 'secondaryPhone', labelKey: 'ds160.addressPhone.secondaryPhone', type: 'text' },
            { key: 'workPhone', labelKey: 'ds160.addressPhone.workPhone', type: 'text' },
            { key: 'hasOtherPhones', labelKey: 'ds160.addressPhone.hasOtherPhones', type: 'radio', options: YES_NO },
          ],
        },
        {
          eyebrowKey: 'ds160.addressPhone.emailEyebrow',
          fields: [
            { key: 'email', labelKey: 'ds160.addressPhone.email', type: 'text', required: true },
            { key: 'hasOtherEmails', labelKey: 'ds160.addressPhone.hasOtherEmails', type: 'radio', options: YES_NO },
          ],
        },
        {
          eyebrowKey: 'ds160.addressPhone.socialEyebrow',
          fields: [
            { key: 'hasSocialMedia', labelKey: 'ds160.addressPhone.hasSocialMedia', type: 'radio', required: true, options: YES_NO },
            { key: 'hasOtherWebPresence', labelKey: 'ds160.addressPhone.hasOtherWebPresence', type: 'radio', options: YES_NO },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'socialMediaAccounts',
          labelKey: 'ds160.addressPhone.socialMediaAccountsLabel',
          itemLabelKey: 'ds160.addressPhone.addSocialMedia',
          emptyLabelKey: 'ds160.addressPhone.noSocialMedia',
          fields: [
            { key: 'platform', labelKey: 'ds160.addressPhone.platform', type: 'select', options: SOCIAL_MEDIA_PLATFORM_OPTIONS },
            { key: 'identifier', labelKey: 'ds160.addressPhone.identifier', type: 'text' },
          ],
        },
      ],
    },
  },
  {
    key: 'passport',
    labelKey: 'ds160.sections.passport',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'documentType', labelKey: 'ds160.passport.documentType', type: 'select', required: true, options: PASSPORT_TYPE_OPTIONS },
            { key: 'documentNumber', labelKey: 'ds160.passport.documentNumber', type: 'text', required: true },
            { key: 'bookNumber', labelKey: 'ds160.passport.bookNumber', type: 'text' },
            { key: 'issuingCountry', labelKey: 'ds160.passport.issuingCountry', type: 'select', required: true, options: COUNTRY_OPTIONS },
            { key: 'issuingCity', labelKey: 'ds160.passport.issuingCity', type: 'text' },
            { key: 'issuingState', labelKey: 'ds160.passport.issuingState', type: 'text' },
            { key: 'issuanceDate', labelKey: 'ds160.passport.issuanceDate', type: 'date', required: true },
            { key: 'expirationDate', labelKey: 'ds160.passport.expirationDate', type: 'date', required: true },
            { key: 'wasLostOrStolen', labelKey: 'ds160.passport.wasLostOrStolen', type: 'radio', required: true, options: YES_NO },
          ],
        },
      ],
    },
  },
  {
    key: 'usContact',
    labelKey: 'ds160.sections.usContact',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'contactSurname', labelKey: 'ds160.usContact.contactSurname', type: 'text' },
            { key: 'contactGivenNames', labelKey: 'ds160.usContact.contactGivenNames', type: 'text' },
            { key: 'organizationName', labelKey: 'ds160.usContact.organizationName', type: 'text' },
            { key: 'relationship', labelKey: 'ds160.usContact.relationship', type: 'select', options: RELATIONSHIP_OPTIONS },
            { key: 'address', labelKey: 'ds160.usContact.address', type: 'text' },
            { key: 'phone', labelKey: 'ds160.usContact.phone', type: 'text' },
          ],
        },
      ],
    },
  },
  {
    key: 'familyInfo',
    labelKey: 'ds160.sections.familyInfo',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'hasImmediateRelativesInUS', labelKey: 'ds160.familyInfo.hasImmediateRelativesInUS', type: 'radio', required: true, options: YES_NO },
            { key: 'hasOtherRelativesInUS', labelKey: 'ds160.familyInfo.hasOtherRelativesInUS', type: 'radio', required: true, options: YES_NO },
          ],
        },
      ],
    },
  },
  {
    key: 'presentWork',
    labelKey: 'ds160.sections.presentWork',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'occupation', labelKey: 'ds160.presentWork.occupation', type: 'select', required: true, options: OCCUPATION_OPTIONS },
            { key: 'employerOrSchoolName', labelKey: 'ds160.presentWork.employerOrSchoolName', type: 'text', required: true },
            { key: 'streetAddress1', labelKey: 'ds160.presentWork.streetAddress1', type: 'text' },
            { key: 'streetAddress2', labelKey: 'ds160.presentWork.streetAddress2', type: 'text' },
            { key: 'city', labelKey: 'ds160.presentWork.city', type: 'text' },
            { key: 'stateProvince', labelKey: 'ds160.presentWork.stateProvince', type: 'text' },
            { key: 'postalCode', labelKey: 'ds160.presentWork.postalCode', type: 'text' },
            { key: 'country', labelKey: 'ds160.presentWork.country', type: 'select', options: COUNTRY_OPTIONS },
            { key: 'phone', labelKey: 'ds160.presentWork.phone', type: 'text' },
            { key: 'startDate', labelKey: 'ds160.presentWork.startDate', type: 'date' },
            { key: 'monthlyIncome', labelKey: 'ds160.presentWork.monthlyIncome', type: 'text' },
            { key: 'duties', labelKey: 'ds160.presentWork.duties', type: 'textarea' },
          ],
        },
      ],
    },
  },
  {
    key: 'previousWork',
    labelKey: 'ds160.sections.previousWork',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'wasPreviouslyEmployed', labelKey: 'ds160.previousWork.wasPreviouslyEmployed', type: 'radio', required: true, options: YES_NO },
            { key: 'attendedSecondaryOrAbove', labelKey: 'ds160.previousWork.attendedSecondaryOrAbove', type: 'radio', required: true, options: YES_NO },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'jobs',
          labelKey: 'ds160.previousWork.jobsLabel',
          itemLabelKey: 'ds160.previousWork.addJob',
          emptyLabelKey: 'ds160.previousWork.noJobs',
          fields: [
            { key: 'employerName', labelKey: 'ds160.previousWork.employerName', type: 'text' },
            { key: 'jobTitle', labelKey: 'ds160.previousWork.jobTitle', type: 'text' },
            { key: 'supervisorSurname', labelKey: 'ds160.previousWork.supervisorSurname', type: 'text' },
            { key: 'fromDate', labelKey: 'ds160.previousWork.fromDate', type: 'date' },
            { key: 'toDate', labelKey: 'ds160.previousWork.toDate', type: 'date' },
          ],
        },
        {
          key: 'schools',
          labelKey: 'ds160.previousWork.schoolsLabel',
          itemLabelKey: 'ds160.previousWork.addSchool',
          emptyLabelKey: 'ds160.previousWork.noSchools',
          fields: [
            { key: 'schoolName', labelKey: 'ds160.previousWork.schoolName', type: 'text' },
            { key: 'courseOfStudy', labelKey: 'ds160.previousWork.courseOfStudy', type: 'text' },
            { key: 'fromDate', labelKey: 'ds160.previousWork.fromDate', type: 'date' },
            { key: 'toDate', labelKey: 'ds160.previousWork.toDate', type: 'date' },
          ],
        },
      ],
    },
  },
  {
    key: 'additionalWork',
    labelKey: 'ds160.sections.additionalWork',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'belongsToClanOrTribe', labelKey: 'ds160.additionalWork.belongsToClanOrTribe', type: 'radio', required: true, options: YES_NO },
            { key: 'belongsToClanOrTribeExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'hasTraveledLast5Years', labelKey: 'ds160.additionalWork.hasTraveledLast5Years', type: 'radio', required: true, options: YES_NO },
            { key: 'hasOrgMembership', labelKey: 'ds160.additionalWork.hasOrgMembership', type: 'radio', required: true, options: YES_NO },
            { key: 'hasOrgMembershipExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'hasSpecializedSkills', labelKey: 'ds160.additionalWork.hasSpecializedSkills', type: 'radio', required: true, options: YES_NO },
            { key: 'hasSpecializedSkillsExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'hasMilitaryService', labelKey: 'ds160.additionalWork.hasMilitaryService', type: 'radio', required: true, options: YES_NO },
            { key: 'hasMilitaryServiceExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'hasParamilitaryInvolvement', labelKey: 'ds160.additionalWork.hasParamilitaryInvolvement', type: 'radio', required: true, options: YES_NO },
            { key: 'hasParamilitaryInvolvementExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'languages',
          labelKey: 'ds160.additionalWork.languagesLabel',
          itemLabelKey: 'ds160.additionalWork.addLanguage',
          emptyLabelKey: 'ds160.additionalWork.noLanguages',
          fields: [{ key: 'language', labelKey: 'ds160.additionalWork.language', type: 'text' }],
        },
        {
          key: 'countriesVisited',
          labelKey: 'ds160.additionalWork.countriesVisitedLabel',
          itemLabelKey: 'ds160.additionalWork.addCountry',
          emptyLabelKey: 'ds160.additionalWork.noCountriesVisited',
          fields: [{ key: 'country', labelKey: 'ds160.additionalWork.country', type: 'select', options: COUNTRY_OPTIONS }],
        },
      ],
    },
  },
  {
    key: 'security1',
    labelKey: 'ds160.sections.security1',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'ds160.security.description',
          fields: [
            { key: 'communicableDisease', labelKey: 'ds160.security1.communicableDisease', type: 'radio', required: true, options: YES_NO },
            { key: 'communicableDiseaseExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'mentalOrPhysicalDisorder', labelKey: 'ds160.security1.mentalOrPhysicalDisorder', type: 'radio', required: true, options: YES_NO },
            { key: 'mentalOrPhysicalDisorderExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'drugAbuserOrAddict', labelKey: 'ds160.security1.drugAbuserOrAddict', type: 'radio', required: true, options: YES_NO },
            { key: 'drugAbuserOrAddictExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
          ],
        },
      ],
    },
  },
  {
    key: 'security2',
    labelKey: 'ds160.sections.security2',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'ds160.security.description',
          fields: [
            { key: 'arrestedOrConvicted', labelKey: 'ds160.security2.arrestedOrConvicted', type: 'radio', required: true, options: YES_NO },
            { key: 'arrestedOrConvictedExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'controlledSubstancesViolation', labelKey: 'ds160.security2.controlledSubstancesViolation', type: 'radio', required: true, options: YES_NO },
            { key: 'controlledSubstancesViolationExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'prostitution', labelKey: 'ds160.security2.prostitution', type: 'radio', required: true, options: YES_NO },
            { key: 'prostitutionExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'moneyLaundering', labelKey: 'ds160.security2.moneyLaundering', type: 'radio', required: true, options: YES_NO },
            { key: 'moneyLaunderingExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'humanTraffickingCommitted', labelKey: 'ds160.security2.humanTraffickingCommitted', type: 'radio', required: true, options: YES_NO },
            { key: 'humanTraffickingCommittedExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'humanTraffickingAided', labelKey: 'ds160.security2.humanTraffickingAided', type: 'radio', required: true, options: YES_NO },
            { key: 'humanTraffickingAidedExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'humanTraffickingFamilyBenefit', labelKey: 'ds160.security2.humanTraffickingFamilyBenefit', type: 'radio', required: true, options: YES_NO },
            { key: 'humanTraffickingFamilyBenefitExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
          ],
        },
      ],
    },
  },
  {
    key: 'security3',
    labelKey: 'ds160.sections.security3',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'ds160.security.description',
          fields: [
            { key: 'espionageOrSabotage', labelKey: 'ds160.security3.espionageOrSabotage', type: 'radio', required: true, options: YES_NO },
            { key: 'espionageOrSabotageExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'terroristActivities', labelKey: 'ds160.security3.terroristActivities', type: 'radio', required: true, options: YES_NO },
            { key: 'terroristActivitiesExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'terroristFinancialSupport', labelKey: 'ds160.security3.terroristFinancialSupport', type: 'radio', required: true, options: YES_NO },
            { key: 'terroristFinancialSupportExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'terroristOrgMember', labelKey: 'ds160.security3.terroristOrgMember', type: 'radio', required: true, options: YES_NO },
            { key: 'terroristOrgMemberExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'terroristFamilyMember', labelKey: 'ds160.security3.terroristFamilyMember', type: 'radio', required: true, options: YES_NO },
            { key: 'terroristFamilyMemberExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'genocide', labelKey: 'ds160.security3.genocide', type: 'radio', required: true, options: YES_NO },
            { key: 'genocideExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'torture', labelKey: 'ds160.security3.torture', type: 'radio', required: true, options: YES_NO },
            { key: 'tortureExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'extrajudicialKillings', labelKey: 'ds160.security3.extrajudicialKillings', type: 'radio', required: true, options: YES_NO },
            { key: 'extrajudicialKillingsExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'childSoldiers', labelKey: 'ds160.security3.childSoldiers', type: 'radio', required: true, options: YES_NO },
            { key: 'childSoldiersExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'religiousFreedomViolations', labelKey: 'ds160.security3.religiousFreedomViolations', type: 'radio', required: true, options: YES_NO },
            { key: 'religiousFreedomViolationsExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'forcedAbortionOrSterilization', labelKey: 'ds160.security3.forcedAbortionOrSterilization', type: 'radio', required: true, options: YES_NO },
            { key: 'forcedAbortionOrSterilizationExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'coerciveOrganTransplant', labelKey: 'ds160.security3.coerciveOrganTransplant', type: 'radio', required: true, options: YES_NO },
            { key: 'coerciveOrganTransplantExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
          ],
        },
      ],
    },
  },
  {
    key: 'security4',
    labelKey: 'ds160.sections.security4',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'ds160.security.description',
          fields: [
            { key: 'fraudOrMisrepresentation', labelKey: 'ds160.security4.fraudOrMisrepresentation', type: 'radio', required: true, options: YES_NO },
            { key: 'fraudOrMisrepresentationExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'removedOrDeported', labelKey: 'ds160.security4.removedOrDeported', type: 'radio', required: true, options: YES_NO },
            { key: 'removedOrDeportedExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
          ],
        },
      ],
    },
  },
  {
    key: 'security5',
    labelKey: 'ds160.sections.security5',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'ds160.security.description',
          fields: [
            { key: 'withheldChildCustody', labelKey: 'ds160.security5.withheldChildCustody', type: 'radio', required: true, options: YES_NO },
            { key: 'withheldChildCustodyExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'votedUnlawfully', labelKey: 'ds160.security5.votedUnlawfully', type: 'radio', required: true, options: YES_NO },
            { key: 'votedUnlawfullyExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
            { key: 'renouncedCitizenshipForTax', labelKey: 'ds160.security5.renouncedCitizenshipForTax', type: 'radio', required: true, options: YES_NO },
            { key: 'renouncedCitizenshipForTaxExplain', labelKey: 'ds160.explainIfYes', type: 'textarea' },
          ],
        },
      ],
    },
  },
  {
    key: 'additionalContacts',
    labelKey: 'ds160.sections.additionalContacts',
    def: {
      kind: 'simple',
      groups: [{ fields: [] }],
      nestedRepeatables: [
        {
          key: 'contacts',
          labelKey: 'ds160.additionalContacts.contactsLabel',
          itemLabelKey: 'ds160.additionalContacts.addContact',
          emptyLabelKey: 'ds160.additionalContacts.noContacts',
          maxItems: 2,
          fields: [
            { key: 'surname', labelKey: 'ds160.additionalContacts.surname', type: 'text' },
            { key: 'givenNames', labelKey: 'ds160.additionalContacts.givenNames', type: 'text' },
            { key: 'streetAddress1', labelKey: 'ds160.additionalContacts.streetAddress1', type: 'text' },
            { key: 'city', labelKey: 'ds160.additionalContacts.city', type: 'text' },
            { key: 'country', labelKey: 'ds160.additionalContacts.country', type: 'select', options: COUNTRY_OPTIONS },
            { key: 'phone', labelKey: 'ds160.additionalContacts.phone', type: 'text' },
            { key: 'email', labelKey: 'ds160.additionalContacts.email', type: 'text' },
          ],
        },
      ],
    },
  },
  {
    key: 'sevisSchool',
    labelKey: 'ds160.sections.sevisSchool',
    def: {
      kind: 'simple',
      groups: [
        {
          fields: [
            { key: 'sevisId', labelKey: 'ds160.sevisSchool.sevisId', type: 'text', required: true, placeholderKey: 'ds160.sevisSchool.sevisIdPlaceholder' },
            { key: 'schoolName', labelKey: 'ds160.sevisSchool.schoolName', type: 'text', required: true },
            { key: 'courseOfStudy', labelKey: 'ds160.sevisSchool.courseOfStudy', type: 'text' },
            { key: 'schoolAddress', labelKey: 'ds160.sevisSchool.schoolAddress', type: 'text', required: true },
          ],
        },
      ],
    },
  },
  {
    key: 'photo',
    labelKey: 'ds160.sections.photo',
    def: {
      kind: 'simple',
      groups: [{ fields: [] }],
    },
  },
]

export interface Ds160FieldSchemaEntry {
  section: string
  field: string
  label: string
  type: FieldDef['type']
  options?: string[]
  repeatable?: boolean
  nestedKey?: string
}

export interface Ds160SectionStatus {
  key: string
  labelKey: string
  /** All required fields are filled in (see isProfileSectionComplete). */
  fieldsComplete: boolean
  /** The student has been through the Review & Confirm step for this page (see ds160-workspace.tsx). */
  confirmed: boolean
}

/**
 * "Done" for a DS-160 page means confirmed, not just filled in - the whole
 * point of the Review & Confirm step (and AI risk check) is that filled-in
 * isn't the same as reviewed. Used by the Visa AI assistant to tell a
 * student what's actually blocking them from being ready to submit.
 */
/** Pages that only apply to F1/student applicants in the real DS-160 form. */
export const F1_ONLY_SECTIONS = ['sevisSchool', 'additionalContacts']

export function computeDS160Progress(
  data: Record<string, any>,
  isF1Selected: boolean,
): { confirmed: number; total: number; sections: Ds160SectionStatus[] } {
  const confirmedMap: Record<string, string> = data['_confirmed'] || {}
  const sections = DS160_SECTIONS.filter((s) => isF1Selected || !F1_ONLY_SECTIONS.includes(s.key)).map((s) => ({
    key: s.key,
    labelKey: s.labelKey,
    fieldsComplete: isProfileSectionComplete(data[s.key], s.def),
    confirmed: confirmedMap[s.key] === 'true',
  }))
  return { confirmed: sections.filter((s) => s.confirmed).length, total: sections.length, sections }
}

/** Sections that document auto-fill should never touch - nothing in a passport/ID/I-20 answers
 * these, and security questions are handled by defaulting to "No" and having the student review
 * them directly rather than letting an LLM guess at security-sensitive answers from a document. */
const AUTOFILL_EXCLUDED_SECTIONS = ['setup', 'security1', 'security2', 'security3', 'security4', 'security5']

/**
 * Flattens DS-160 fields into a schema-aware list for the document
 * auto-fill endpoint (mirrors buildFieldSchema in profile-schema.ts).
 * Nested-repeatable field keys are qualified as "<nestedKey>.<field>" to
 * avoid colliding with a same-named flat field, same convention used there.
 */
export function buildDS160FieldSchema(t: (key: string) => string): Ds160FieldSchemaEntry[] {
  const entries: Ds160FieldSchemaEntry[] = []
  for (const section of DS160_SECTIONS) {
    if (AUTOFILL_EXCLUDED_SECTIONS.includes(section.key) || section.def.kind !== 'simple') continue
    for (const group of section.def.groups) {
      for (const field of group.fields) {
        entries.push({ section: section.key, field: field.key, label: t(field.labelKey), type: field.type, options: field.options })
      }
    }
    for (const nested of section.def.nestedRepeatables || []) {
      for (const field of nested.fields) {
        entries.push({
          section: section.key,
          field: `${nested.key}.${field.key}`,
          label: t(field.labelKey),
          type: field.type,
          options: field.options,
          repeatable: true,
          nestedKey: nested.key,
        })
      }
    }
  }
  return entries
}
