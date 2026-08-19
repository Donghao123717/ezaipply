/**
 * Real admissions data for the US News 2026 Top 50 National Universities.
 * Acceptance rate and SAT/ACT ranges are cross-verified against IPEDS
 * (nces.ed.gov/collegenavigator) - the federal database compiled directly
 * from each school's official Common Data Set submission, and the single
 * most consistent source across all 50 schools (same Fall 2024 cohort,
 * same methodology). GPA and essay supplement prompts aren't collected by
 * IPEDS, so those come from each school's own admissions pages (see
 * sourceNote per entry). Keyed by the exact `name` string used in
 * colleges-database.ts so it can be looked up by name without an id join.
 *
 * Fields are intentionally left undefined rather than filled with a guess
 * when a school doesn't publish that figure (common for highly selective
 * private schools - many don't release GPA data at all). `testBlind` marks
 * UC campuses and similar schools where SAT/ACT genuinely play no role in
 * admissions, which is different from "we couldn't find the number" - IPEDS
 * independently confirms these schools report no score data.
 *
 * This is a point-in-time research snapshot (see each entry's `cycle`), not
 * a live feed - re-verify before a new admissions cycle if this ships
 * beyond a demo.
 */

export interface SchoolAdmissionsData {
  /** Composite SAT, 25th-75th percentile, e.g. [1510, 1570]. */
  satRange?: [number, number]
  /** Composite ACT, 25th-75th percentile. */
  actRange?: [number, number]
  /** Unweighted GPA on a 4.0 scale, 25th-75th percentile or average-as-a-single-point range. Omitted (not guessed) if the school only publishes a weighted figure or nothing at all. */
  gpaRange?: [number, number]
  /** Supplementary GPA context when a clean unweighted 4.0-scale figure wasn't available (e.g. a weighted average). */
  gpaNote?: string
  /** True if the school does not use SAT/ACT in admissions at all (e.g. UC campuses) - distinct from data simply being unavailable. */
  testBlind?: boolean
  /** Overall undergraduate acceptance rate, 0-100. */
  acceptanceRate: number
  deadlines: { ed?: string; ea?: string; rd?: string }
  essaySupplements: { prompt: string; wordLimit: number }[]
  /** Admissions cycle this data reflects, e.g. "2026-27". */
  cycle: string
  /** Short source citation shown in the UI for transparency. */
  sourceNote: string
}

export const SCHOOL_ADMISSIONS_DATA: Record<string, SchoolAdmissionsData> = {
  'Princeton University': {
    satRange: [1510, 1580],
    actRange: [34, 35],
    gpaNote: '~72% of admits had a 4.0 unweighted GPA; no formal range published',
    acceptanceRate: 5,
    deadlines: { ea: 'November 1', rd: 'January 1' },
    essaySupplements: [
      { prompt: 'What academic areas most pique your curiosity, and how do the programs offered at Princeton suit your particular interests?', wordLimit: 250 },
      { prompt: 'Princeton values community. Reflect on how your lived experiences will impact the conversations you will have in the classroom, the dining hall, or other campus spaces.', wordLimit: 500 },
      { prompt: 'Princeton has a longstanding commitment to service and civic engagement. How does your own story intersect with these ideals?', wordLimit: 250 },
    ],
    cycle: '2025-26',
    sourceNote: 'Acceptance rate/SAT/ACT: IPEDS Fall 2024 cohort (nces.ed.gov/collegenavigator). Essays/deadlines: Princeton admission office.',
  },
  'Massachusetts Institute of Technology': {
    satRange: [1520, 1580],
    actRange: [34, 36],
    acceptanceRate: 5,
    deadlines: { ea: 'November 1', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'What field of study appeals to you the most right now? Reflect on what has led you to this interest.', wordLimit: 200 },
      { prompt: 'How did you manage a situation or challenge that you didn’t expect? What did you learn from it?', wordLimit: 200 },
      { prompt: 'Reflect on how your personal and academic experiences have influenced the types of problems you would want to tackle with an MIT education.', wordLimit: 200 },
    ],
    cycle: '2026-27',
    sourceNote: 'MIT Common Data Set (ir.mit.edu); MIT Admissions [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Harvard University': {
    satRange: [1510, 1580],
    actRange: [34, 36],
    gpaNote: '72.4% of Class of 2029 had a 4.0 unweighted GPA; no formal range published',
    acceptanceRate: 4,
    deadlines: { ea: 'November 1', rd: 'January 1' },
    essaySupplements: [
      { prompt: 'Harvard has long recognized the importance of enrolling a student body with a diversity of perspectives. How will the life experiences that shaped who you are today enable you to contribute to Harvard?', wordLimit: 150 },
      { prompt: 'Describe a time when you strongly disagreed with someone about an idea or issue. How did you engage with this person, and what did you learn?', wordLimit: 150 },
      { prompt: 'Briefly describe any of your extracurricular activities, employment experience, travel, or family responsibilities that have shaped who you are.', wordLimit: 150 },
    ],
    cycle: '2026-27',
    sourceNote: 'Harvard Admissions class profile; cross-checked aggregators [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Stanford University': {
    satRange: [1510, 1580],
    actRange: [34, 35],
    gpaRange: [3.94, 4.0],
    acceptanceRate: 4,
    deadlines: { ea: 'November 1', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'What is the most significant challenge that society faces today?', wordLimit: 50 },
      { prompt: 'Virtually all of Stanford’s undergraduates live on campus. Write a note to your future roommate that reveals something about you.', wordLimit: 250 },
      { prompt: 'Reflect on an idea or experience that makes you genuinely excited about learning.', wordLimit: 250 },
    ],
    cycle: '2026-27',
    sourceNote: 'Stanford Admissions decision process page; aggregator cross-check [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Yale University': {
    satRange: [1470, 1570],
    actRange: [33, 35],
    gpaNote: 'Median unweighted GPA ~3.95; Yale rates GPA at its lowest formal evaluation tier and does not publish a range',
    acceptanceRate: 4,
    deadlines: { ea: 'November 1', rd: 'January 2' },
    essaySupplements: [
      { prompt: 'Tell us about a topic or idea that excites you and is related to one or more academic areas you selected. Why are you drawn to it?', wordLimit: 200 },
      { prompt: 'Reflect on a time you discussed an issue important to you with someone holding an opposing view. Why did you find the experience meaningful?', wordLimit: 400 },
      { prompt: 'Reflect on your membership in a community to which you feel connected. Why is this community meaningful to you?', wordLimit: 400 },
    ],
    cycle: '2026-27',
    sourceNote: 'Yale Admissions; Common Data Set aggregation [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Chicago': {
    satRange: [1510, 1580],
    actRange: [34, 35],
    gpaNote: 'Average admitted GPA near 4.0 unweighted; no formal range published',
    acceptanceRate: 4,
    deadlines: { ed: 'November 3', ea: 'November 3', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'How does the University of Chicago, as you know it now, satisfy your desire for a particular kind of learning, community, and future? ("Why UChicago")', wordLimit: 600 },
      { prompt: 'Extended Essay: choose one of UChicago’s distinctive, unconventional prompts (e.g. "How do thoughts eat?") or write on a prompt of your own.', wordLimit: 600 },
    ],
    cycle: '2026-27',
    sourceNote: 'UChicago admissions statistics (most recent released cycle); UChicago Admissions essay prompts [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Duke University': {
    satRange: [1500, 1570],
    actRange: [34, 35],
    gpaNote: '99% of enrolled students in top quarter of HS class by rank; no unweighted GPA figure published',
    acceptanceRate: 6,
    deadlines: { ed: 'November 2', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'What is your impression of Duke as a university and community, and why do you believe it is a good match for your goals, values, and interests?', wordLimit: 250 },
      { prompt: 'We all belong to communities defined by place, faith, family, culture, interests, or shared experience. Tell us about a community that has shaped who you are.', wordLimit: 250 },
      { prompt: 'Meaningful dialogue often involves respectful disagreement. Provide an example of a difference of opinion you’ve had with someone you care about. What did you learn from it?', wordLimit: 250 },
    ],
    cycle: '2026-27',
    sourceNote: 'Duke Admissions class profile; Duke Admissions checklist [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Johns Hopkins University': {
    satRange: [1520, 1570],
    actRange: [34, 36],
    gpaRange: [3.75, 4.0],
    gpaNote: 'Average unweighted GPA ~3.9-3.93; 91.5% of enrolled students reported 3.75+',
    acceptanceRate: 6,
    deadlines: { ed: 'November 1', rd: 'January 2' },
    essaySupplements: [
      { prompt: 'At Johns Hopkins, community is built through dialogue, collaboration, and a willingness to engage across differences. What have you learned about engaging across differences and building bridges?', wordLimit: 350 },
    ],
    cycle: '2026-27',
    sourceNote: 'JHU Admissions application requirements; aggregator cross-check [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Northwestern University': {
    satRange: [1510, 1570],
    actRange: [33, 35],
    gpaNote: 'Average GPA of admitted students reported ~3.92; no official range published',
    acceptanceRate: 8,
    deadlines: { ed: 'November 1', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'What aspects of your background (your identity, your school setting, your community, your household, etc.) have most shaped how you see yourself engaging in Northwestern’s community?', wordLimit: 300 },
      { prompt: '"The Rock" is a tradition at Northwestern where students paint messages. What would you paint on The Rock, and why?', wordLimit: 200 },
    ],
    cycle: '2026-27',
    sourceNote: 'Northwestern class facts & figures; aggregator cross-check (some source variance on exact SAT/ACT bounds) [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Pennsylvania': {
    satRange: [1510, 1570],
    actRange: [34, 36],
    gpaNote: 'Average high school GPA of enrolled first-years ~3.9 unweighted; no formal range published',
    acceptanceRate: 5,
    deadlines: { ed: 'November 1', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'Write a short thank-you note to someone you have not yet thanked and would like to acknowledge.', wordLimit: 200 },
      { prompt: 'How will you explore community at Penn? Consider how Penn will help shape your perspective, and how your experiences will help shape Penn.', wordLimit: 200 },
    ],
    cycle: '2026-27',
    sourceNote: 'Penn Admissions class profile; Penn Admissions essay requirements [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'California Institute of Technology': {
    gpaNote: 'Most admits have unweighted GPA at or near 4.0; no formal figure published',
    acceptanceRate: 3,
    deadlines: { ea: 'November 1', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'If you had to choose an area of interest or two today, what would you choose? Why did you choose your proposed area of interest?', wordLimit: 200 },
      { prompt: 'What would you contribute to the Caltech community?', wordLimit: 150 },
    ],
    cycle: '2026-27',
    sourceNote: 'Caltech Admissions - note: Caltech reinstated testing for this cycle after a test-free period, so no current official SAT/ACT range exists yet [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Cornell University': {
    satRange: [1500, 1570],
    actRange: [33, 35],
    gpaNote: '93% of enrolled students in top 10% of HS class; no unweighted GPA figure published',
    acceptanceRate: 9,
    deadlines: { ed: 'November 1', rd: 'January 2' },
    essaySupplements: [
      { prompt: 'College-specific "why this school/program" essay (Cornell dropped its university-wide essay - prompts are now specific to the undergraduate college applied to).', wordLimit: 650 },
    ],
    cycle: '2026-27',
    sourceNote: 'Cornell Admissions how-to-apply; Common Data Set aggregation [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Brown University': {
    satRange: [1510, 1580],
    actRange: [34, 35],
    acceptanceRate: 5,
    deadlines: { ed: 'November 1', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'How will you use these characteristics (intellectual curiosity, creativity, collaboration, resilience, etc.) to shape your approach to the Open Curriculum?', wordLimit: 250 },
      { prompt: 'If you could teach a class on any one thing, whether academic or otherwise, what would it be?', wordLimit: 150 },
      { prompt: 'Reflect on an aspect of your growing-up environment and its impact on you.', wordLimit: 250 },
    ],
    cycle: '2026-27',
    sourceNote: 'Brown Office of Institutional Research Common Data Set; Brown Admissions [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Dartmouth College': {
    satRange: [1500, 1570],
    actRange: [33, 35],
    gpaNote: '94.1% of enrolled freshmen in top 10% of HS class; no unweighted GPA figure published',
    acceptanceRate: 5,
    deadlines: { ed: 'November 1', rd: 'January 1' },
    essaySupplements: [
      { prompt: 'What aspects of Dartmouth’s academic program, community, and/or campus environment attract your interest? How is Dartmouth a good fit for you?', wordLimit: 100 },
      { prompt: '"Be yourself," Oscar Wilde advised. "Everyone else is taken." Introduce yourself.', wordLimit: 250 },
    ],
    cycle: '2026-27',
    sourceNote: 'Aggregated admissions data; Dartmouth essay prompt guides [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Columbia University': {
    satRange: [1510, 1580],
    actRange: [34, 35],
    gpaNote: 'No official GPA figure published in Columbia’s Common Data Set',
    acceptanceRate: 4,
    deadlines: { ed: 'November 1', rd: 'January 1' },
    essaySupplements: [
      { prompt: 'Tell us about an aspect of your life so far or your lived experience that is important to you, and describe how it has shaped the way you would learn from and contribute to Columbia.', wordLimit: 150 },
      { prompt: 'Please describe a time when you did not agree with someone and discuss how you engaged with them and what you took away from the interaction.', wordLimit: 150 },
      { prompt: 'What attracts you to your preferred areas of study at Columbia College or Columbia Engineering?', wordLimit: 150 },
    ],
    cycle: '2026-27',
    sourceNote: 'Columbia Office of Planning & Institutional Research (CDS); aggregator cross-check [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of California, Berkeley': {
    testBlind: true,
    gpaRange: [3.9, 4.0],
    gpaNote: 'Average unweighted GPA ~3.92',
    acceptanceRate: 11,
    deadlines: { rd: 'November 30' },
    essaySupplements: [
      { prompt: 'Describe an example of your leadership experience in which you have positively influenced others, helped resolve disputes, or contributed to group efforts over time.', wordLimit: 350 },
      { prompt: 'Describe how you have taken advantage of a significant educational opportunity or worked to overcome an educational barrier you have faced.', wordLimit: 350 },
      { prompt: 'Every person has a creative side. Describe how you express your creative side. (UC applicants answer 4 of 8 Personal Insight Questions.)', wordLimit: 350 },
    ],
    cycle: '2026-27',
    sourceNote: 'UC Berkeley admissions class profile; UC systemwide application requirements. Test-blind: SAT/ACT not used in admissions. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Rice University': {
    satRange: [1510, 1570],
    actRange: [34, 35],
    gpaNote: '92% of ranked enrollees in top 10% of HS class; no unweighted GPA figure published',
    acceptanceRate: 8,
    deadlines: { ed: 'November 1', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'Please explain why you wish to study in the academic areas you selected.', wordLimit: 150 },
      { prompt: 'The Residential College System is at the heart of Rice student life. What life experiences and/or unique perspectives are you looking forward to sharing with fellow students?', wordLimit: 500 },
    ],
    cycle: '2026-27',
    sourceNote: 'Rice Admissions application info; aggregator cross-check [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of California, Los Angeles': {
    testBlind: true,
    gpaRange: [3.95, 4.0],
    acceptanceRate: 9,
    deadlines: { rd: 'November 30' },
    essaySupplements: [
      { prompt: 'What would you say is your greatest talent or skill? How have you developed and demonstrated that talent over time?', wordLimit: 350 },
      { prompt: 'Describe the most significant challenge you have faced and the steps you have taken to overcome it. (UC applicants answer 4 of 8 Personal Insight Questions.)', wordLimit: 350 },
    ],
    cycle: '2026-27',
    sourceNote: 'UCLA first-year admission profile; UC systemwide application requirements. Test-blind: SAT/ACT not used in admissions. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Vanderbilt University': {
    satRange: [1500, 1570],
    actRange: [34, 35],
    gpaNote: 'Average GPA of admitted students reported ~3.89 (aggregator-sourced, not independently verified on Vanderbilt’s own site)',
    acceptanceRate: 6,
    deadlines: { ed: 'November 1', rd: 'January 1' },
    essaySupplements: [
      { prompt: 'Vanderbilt’s motto is "Crescere aude" - "dare to grow." Reflect on how one or more aspects of your identity, culture, or background has played a role in your personal growth.', wordLimit: 250 },
    ],
    cycle: '2026-27',
    sourceNote: 'Vanderbilt Admissions; Common Data Set aggregation [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Carnegie Mellon University': {
    satRange: [1500, 1570],
    actRange: [34, 35],
    gpaRange: [3.75, 4.0],
    gpaNote: 'Average enrolled GPA 3.89; 47% had 4.0+',
    acceptanceRate: 12,
    deadlines: { ed: 'November 2', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'What passion or inspiration led you to choose your intended area of study?', wordLimit: 300 },
      { prompt: 'As you think ahead to the process of learning during your college years, how will you define a successful college experience?', wordLimit: 300 },
      { prompt: 'Consider your application as a whole. What do you personally want to emphasize about your application for the admission committee’s consideration?', wordLimit: 300 },
    ],
    cycle: '2026-27',
    sourceNote: 'CMU Common Data Set 2024-25 (cmu.edu/ira); CMU Admissions [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Michigan': {
    satRange: [1360, 1530],
    actRange: [31, 34],
    gpaRange: [3.9, 3.9],
    gpaNote: 'Average unweighted GPA of enrolled first-years',
    acceptanceRate: 16,
    deadlines: { ed: 'November 1', ea: 'November 1', rd: 'February 1' },
    essaySupplements: [
      { prompt: 'Share with us how you are prepared to contribute to developing leaders and citizens who will challenge the present and enrich the future.', wordLimit: 300 },
      { prompt: 'Why [your specific Michigan school/college]? Describe what attracts you to it and how its curriculum supports your interests.', wordLimit: 550 },
    ],
    cycle: '2025-26',
    sourceNote: 'University of Michigan Common Data Set 2025-26 (obp.umich.edu) [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Notre Dame': {
    satRange: [1455, 1560],
    actRange: [33, 35],
    gpaNote: 'Typical admitted GPA 3.95+ (test-optional; not a formal CDS range)',
    acceptanceRate: 11,
    deadlines: { ea: 'November 1', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'Briefly share what draws you to the area(s) of study you listed.', wordLimit: 100 },
      { prompt: 'Everyone has different priorities when considering their college list. Tell us about your "non-negotiable" factor(s) when searching for your future college home.', wordLimit: 150 },
    ],
    cycle: '2025-26',
    sourceNote: 'Notre Dame Admissions; aggregator cross-check [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Washington University in St. Louis': {
    satRange: [1500, 1570],
    actRange: [33, 35],
    acceptanceRate: 12,
    deadlines: { ed: 'November 2', ea: 'November 2', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'What is a community you are a part of, and what has been your role or impact within it? ("In St. Louis, For St. Louis")', wordLimit: 250 },
      { prompt: 'What academic areas are you interested in exploring at WashU and why?', wordLimit: 200 },
    ],
    cycle: '2026-27',
    sourceNote: 'WashU Admissions application dates & deadlines; aggregator cross-check. Note: WashU added an EA option for this cycle. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Emory University': {
    satRange: [1470, 1550],
    actRange: [32, 35],
    gpaRange: [3.5, 3.99],
    gpaNote: 'Average 3.83 for Class of 2029',
    acceptanceRate: 11,
    deadlines: { ed: 'November 1', rd: 'January 1' },
    essaySupplements: [
      { prompt: 'What academic areas are you interested in exploring at Emory and why?', wordLimit: 200 },
      { prompt: 'Choose one: describe a community you helped shape, a time you expanded your cultural awareness, how you’d contribute to Emory’s mission of service, or how you navigate disagreement.', wordLimit: 150 },
    ],
    cycle: '2025-26',
    sourceNote: 'Emory Admissions class profile; aggregator cross-check [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Georgetown University': {
    satRange: [1390, 1550],
    actRange: [32, 35],
    gpaNote: 'Admitted students placed in top 6% of HS class; no unweighted GPA figure published',
    acceptanceRate: 13,
    deadlines: { ea: 'November 1', rd: 'January 10' },
    essaySupplements: [
      { prompt: 'In all our lives, we interact with people who hold different viewpoints than our own. Describe such an event you experienced. What did you learn from the experience?', wordLimit: 250 },
      { prompt: 'Please submit a brief personal or creative essay which you feel best describes you and reflects on your personal background and individual experiences, skills, and talents. (approx. one page)', wordLimit: 500 },
    ],
    cycle: '2025-26',
    sourceNote: 'Georgetown Admissions applying page - note: two of Georgetown’s prompts specify page length rather than a word count; shown here as an approximation [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of North Carolina at Chapel Hill': {
    satRange: [1390, 1530],
    actRange: [28, 34],
    gpaNote: 'Average weighted GPA 4.49; 95% of admits had 4.0+ weighted - no unweighted figure published',
    acceptanceRate: 15,
    deadlines: { ea: 'October 15', rd: 'January 15' },
    essaySupplements: [
      { prompt: 'Discuss one of your personal qualities and share a story of how it helped you make a positive impact on a community.', wordLimit: 250 },
      { prompt: 'Discuss an academic topic that you’re excited to explore and learn more about in college.', wordLimit: 250 },
    ],
    cycle: '2025-26',
    sourceNote: 'UNC Admissions; note UNC has dropped supplemental essays starting the 2026-27 cycle - shown prompts are from the 2025-26 cycle [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Virginia': {
    satRange: [1410, 1540],
    actRange: [32, 35],
    gpaNote: '~90% of admits with reported rank in top 10% of class; no unweighted GPA figure published',
    acceptanceRate: 17,
    deadlines: { ed: 'November 1', ea: 'November 1', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'UVA removed its general supplemental essay for this cycle. Only School of Nursing applicants submit one: why nursing is important to you as your chosen field.', wordLimit: 250 },
    ],
    cycle: '2025-26',
    sourceNote: 'UVA Admissions deadlines; Cavalier Daily on removal of general supplement [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Southern California': {
    satRange: [1450, 1550],
    actRange: [32, 35],
    gpaRange: [3.8, 3.8],
    acceptanceRate: 10,
    deadlines: { ed: 'November 1', ea: 'November 1', rd: 'January 10' },
    essaySupplements: [
      { prompt: 'Describe how you plan to pursue your academic interests and why you want to explore them at USC specifically.', wordLimit: 250 },
      { prompt: 'Ten short-answer questions (brief, single-line responses).', wordLimit: 100 },
    ],
    cycle: '2025-26',
    sourceNote: 'USC Admissions blog; aggregator cross-check. Note: USC added an ED option for this cycle. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of California, San Diego': {
    testBlind: true,
    gpaRange: [3.88, 3.88],
    gpaNote: 'Lower-confidence figure - sourced from an aggregator, not independently cross-checked against UCSD’s official freshman profile page',
    acceptanceRate: 27,
    deadlines: { rd: 'November 30' },
    essaySupplements: [
      { prompt: 'Describe an example of your leadership experience in which you have positively influenced others, helped resolve disputes, or contributed to group efforts over time.', wordLimit: 350 },
      { prompt: 'What have you done to make your school or your community a better place? (UC applicants answer 4 of 8 Personal Insight Questions.)', wordLimit: 350 },
    ],
    cycle: '2026-27',
    sourceNote: 'UC systemwide application requirements. Test-blind: SAT/ACT not used in admissions. Acceptance rate/GPA flagged as lower-confidence - not independently verified against UCSD’s own profile page. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Florida': {
    satRange: [1320, 1480],
    actRange: [29, 33],
    gpaNote: 'Weighted GPA middle-50% 4.5-4.7; no unweighted figure published',
    acceptanceRate: 24,
    deadlines: { ed: 'October 15', ea: 'November 1', rd: 'January 15' },
    essaySupplements: [
      { prompt: 'Please provide more details on your most meaningful commitment outside of the classroom while in high school and explain why it was meaningful.', wordLimit: 250 },
    ],
    cycle: '2025-26',
    sourceNote: 'UF Admissions deadlines; class profile. Note: UF added an ED option for this cycle. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Texas at Austin': {
    satRange: [1250, 1510],
    actRange: [27, 33],
    gpaNote: '~75% of the class is admitted via Texas’s automatic Top 6% law rather than holistic GPA review - no unweighted GPA figure published',
    acceptanceRate: 27,
    deadlines: { rd: 'December 1' },
    essaySupplements: [
      { prompt: 'Share an essay on any topic of your choice (Common App personal essay).', wordLimit: 650 },
      { prompt: 'Why are you interested in the major you indicated as your first-choice major?', wordLimit: 300 },
      { prompt: 'Think of all the activities you have been involved in. Which one are you most proud of, and why?', wordLimit: 300 },
    ],
    cycle: '2026-27',
    sourceNote: 'UT Austin Admissions essays page; deadlines page. Note: acceptance rate is heavily shaped by Texas’s automatic-admission law, not purely holistic review. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Georgia Institute of Technology': {
    satRange: [1370, 1540],
    actRange: [30, 34],
    gpaNote: 'Average weighted GPA 4.14; no unweighted figure published',
    acceptanceRate: 14,
    deadlines: { ea: 'November 2', rd: 'January 6' },
    essaySupplements: [],
    cycle: '2026-27',
    sourceNote: 'Georgia Tech Admissions deadlines; Common Data Set. Note: Georgia Tech eliminated its supplemental essay for this cycle - only the Common App personal essay is required. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'New York University': {
    satRange: [1480, 1560],
    actRange: [34, 35],
    gpaRange: [3.75, 3.99],
    gpaNote: 'Average admitted GPA 3.81; 71.9% of admits had 3.75+',
    acceptanceRate: 9,
    deadlines: { ed: 'November 1', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'Optional: Describe a situation in which your beliefs or opinions were challenged. How did you respond, and what did you take away?', wordLimit: 250 },
      { prompt: 'Optional: Describe a situation in which you worked with a group of diverse people, and what you did to encourage collaboration.', wordLimit: 250 },
    ],
    cycle: '2026-27',
    sourceNote: 'NYU Admissions; aggregator cross-check [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of California, Davis': {
    testBlind: true,
    gpaRange: [3.8, 4.0],
    acceptanceRate: 42,
    deadlines: { rd: 'November 30' },
    essaySupplements: [
      { prompt: 'Describe an example of your leadership experience in which you have positively influenced others, helped resolve disputes, or contributed to group efforts over time.', wordLimit: 350 },
      { prompt: 'Every person has a creative side. Describe how you express it. (UC applicants answer 4 of 8 Personal Insight Questions.)', wordLimit: 350 },
    ],
    cycle: '2026-27',
    sourceNote: 'UC systemwide application requirements; UC Davis admissions data. Test-blind: SAT/ACT not used in admissions. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of California, Irvine': {
    testBlind: true,
    gpaRange: [3.84, 4.0],
    acceptanceRate: 29,
    deadlines: { rd: 'November 30' },
    essaySupplements: [
      { prompt: 'What would you say is your greatest talent or skill? How have you developed and demonstrated that talent over time?', wordLimit: 350 },
      { prompt: 'What have you done to make your school or your community a better place? (UC applicants answer 4 of 8 Personal Insight Questions.)', wordLimit: 350 },
    ],
    cycle: '2026-27',
    sourceNote: 'UC Irvine admitted-student profile; UC systemwide application requirements. Test-blind: SAT/ACT not used in admissions. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Boston College': {
    satRange: [1440, 1540],
    actRange: [33, 35],
    acceptanceRate: 16,
    deadlines: { ed: 'November 1', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'Strong communities are sustained by traditions. Tell us about a meaningful tradition in your family or community.', wordLimit: 400 },
      { prompt: 'Describe your most meaningful conversation partner.', wordLimit: 400 },
    ],
    cycle: '2026-27',
    sourceNote: 'Boston College Common Data Set (bc.edu); BC Admissions [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Tufts University': {
    satRange: [1470, 1560],
    actRange: [33, 35],
    acceptanceRate: 11,
    deadlines: { ed: 'November 2', rd: 'January 4' },
    essaySupplements: [
      { prompt: 'Please describe how you have learned about and engaged with Tufts during your college search process.', wordLimit: 150 },
      { prompt: 'Tell us about one of your favorite school assignments in the past two years, and what made it meaningful.', wordLimit: 200 },
    ],
    cycle: '2026-27',
    sourceNote: 'Tufts Admissions short-answer questions page [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Illinois Urbana-Champaign': {
    satRange: [1310, 1520],
    actRange: [30, 34],
    gpaRange: [3.7, 4.0],
    acceptanceRate: 42,
    deadlines: { ea: 'November 1', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'Describe your personal and/or career goals after graduating from UIUC and how your selected first-choice major will help you achieve them.', wordLimit: 150 },
    ],
    cycle: '2026-27',
    sourceNote: 'UIUC Admissions dates; aggregator cross-check [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Wisconsin-Madison': {
    satRange: [1380, 1520],
    actRange: [29, 33],
    gpaNote: 'Average GPA 3.91; 53.9% of admits had 3.75+',
    acceptanceRate: 45,
    deadlines: { ea: 'November 1', rd: 'January 15' },
    essaySupplements: [
      { prompt: 'Tell us why you would like to attend UW-Madison, and why you are interested in studying the major(s) you have selected.', wordLimit: 650 },
    ],
    cycle: '2026-27',
    sourceNote: 'UW-Madison Admissions required materials page [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of California, Santa Barbara': {
    testBlind: true,
    gpaRange: [3.9, 3.9],
    gpaNote: '~90% of enrolled class had a 4.0 weighted GPA',
    acceptanceRate: 33,
    deadlines: { rd: 'November 30' },
    essaySupplements: [
      { prompt: 'Describe how you have taken advantage of a significant educational opportunity or worked to overcome an educational barrier you have faced.', wordLimit: 350 },
      { prompt: 'What have you done to make your school or your community a better place? (UC applicants answer 4 of 8 Personal Insight Questions.)', wordLimit: 350 },
    ],
    cycle: '2026-27',
    sourceNote: 'UC systemwide application requirements; aggregator cross-check. Test-blind: SAT/ACT not used in admissions. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Ohio State University': {
    satRange: [1310, 1480],
    actRange: [28, 32],
    gpaNote: '73% of enrolled first-years in top 10% of HS class by rank; no unweighted GPA figure published',
    acceptanceRate: 61,
    deadlines: { ea: 'November 1', rd: 'January 15' },
    essaySupplements: [],
    cycle: '2026-27',
    sourceNote: 'Ohio State Common Data Set 2024-25; Ohio State Admissions. No standard word-limited supplemental essay found for general applicants. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Boston University': {
    satRange: [1420, 1530],
    actRange: [32, 34],
    gpaRange: [3.7, 4.0],
    gpaNote: 'Average 3.87',
    acceptanceRate: 11,
    deadlines: { ed: 'November 1', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'What about being a student at BU most excites you?', wordLimit: 300 },
    ],
    cycle: '2026-27',
    sourceNote: 'BU Admissions essay guides; BU Early Decision agreement [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Rutgers University': {
    satRange: [1310, 1500],
    actRange: [28, 33],
    gpaRange: [3.3, 3.8],
    acceptanceRate: 58,
    gpaNote: 'GPA per Rutgers’ official admissions profile; acceptance rate reported here is an approximate midpoint - sources ranged 58-65% and could not be pinned to a single verified figure',
    deadlines: { ea: 'November 1', rd: 'December 1' },
    essaySupplements: [
      { prompt: 'Some students have a background, identity, interest, or talent so meaningful they believe their application would be incomplete without it. If this sounds like you, share your story.', wordLimit: 500 },
      { prompt: 'The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure.', wordLimit: 500 },
    ],
    cycle: '2026-27',
    sourceNote: 'Rutgers Undergraduate Admissions Profile; Rutgers Admissions [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Maryland, College Park': {
    satRange: [1400, 1530],
    actRange: [32, 35],
    gpaNote: 'Weighted average GPA 4.44; 91% of admits at 3.75+ weighted - no unweighted figure published',
    acceptanceRate: 45,
    deadlines: { ea: 'November 1', rd: 'January 20' },
    essaySupplements: [
      { prompt: 'Complete the sentence: "Something you might not know about me is…"', wordLimit: 100 },
      { prompt: 'Complete the sentence: "In addition to my major, my academic interests include…"', wordLimit: 100 },
    ],
    cycle: '2026-27',
    sourceNote: 'UMD Admissions calendar; essay guide aggregation [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Washington': {
    satRange: [1240, 1480],
    actRange: [28, 34],
    gpaNote: 'No verified unweighted GPA figure found from an official source',
    acceptanceRate: 39,
    deadlines: { rd: 'November 15' },
    essaySupplements: [
      { prompt: 'Tell a story from your life, describing an experience that either demonstrates your character or helped to shape it.', wordLimit: 650 },
      { prompt: 'Optional: additional context on hardships or circumstances relevant to your application.', wordLimit: 200 },
    ],
    cycle: '2026-27',
    sourceNote: 'UW Admissions how-to-apply; aggregator cross-check. SAT range not confirmed to a single reliable figure across sources - shown as not found. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Lehigh University': {
    satRange: [1370, 1500],
    actRange: [31, 34],
    gpaNote: 'Average approximately "A-" (~3.81)',
    acceptanceRate: 26,
    deadlines: { ed: 'November 15', rd: 'January 1' },
    essaySupplements: [
      { prompt: 'How would you use a Lehigh education to serve and interpret the world around you?', wordLimit: 150 },
      { prompt: 'Describe a community you belong to and how it has shaped the person you are today.', wordLimit: 150 },
    ],
    cycle: '2026-27',
    sourceNote: 'Aggregator-sourced (Lehigh’s own site was not directly reachable during research) - recommend reconfirming exact ED date and prompts directly on lehigh.edu [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Northeastern University': {
    satRange: [1440, 1540],
    actRange: [33, 35],
    gpaNote: 'Figures not independently verified from an official Common Data Set in this research pass; reported SAT/ACT reflect only the subset of admits who submitted scores',
    acceptanceRate: 5,
    deadlines: { ed: 'November 1', ea: 'November 1', rd: 'January 1' },
    essaySupplements: [],
    cycle: '2026-27',
    sourceNote: 'Aggregator-sourced. No supplemental essay required for most applicants beyond the Common App personal statement. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'Purdue University': {
    satRange: [1200, 1480],
    actRange: [27, 34],
    gpaRange: [3.76, 3.76],
    gpaNote: 'Unweighted average 3.76; weighted average 4.29',
    acceptanceRate: 50,
    deadlines: { ea: 'November 1', rd: 'January 15' },
    essaySupplements: [
      { prompt: 'How will opportunities at Purdue support your interests, both in and out of the classroom?', wordLimit: 250 },
      { prompt: 'Briefly discuss your reasons for choosing your major and your interest in studying at this campus location.', wordLimit: 250 },
    ],
    cycle: '2026-27',
    sourceNote: 'Purdue Common Data Set aggregation; Purdue Admissions essay guide [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Georgia': {
    satRange: [1270, 1480],
    actRange: [29, 34],
    gpaNote: 'Average weighted GPA 4.17; 87% of admits at 3.75+ weighted - no unweighted figure published',
    acceptanceRate: 38,
    deadlines: { ea: 'October 15', rd: 'January 1' },
    essaySupplements: [],
    cycle: '2026-27',
    sourceNote: 'UGA Admissions deadlines; UGA dropped its supplemental essay for the 2026-27 cycle - only the Common App personal essay is required. [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
  'University of Rochester': {
    satRange: [1410, 1540],
    actRange: [31, 34],
    gpaNote: 'Average approximately 3.73',
    acceptanceRate: 40,
    deadlines: { ed: 'November 1', rd: 'January 5' },
    essaySupplements: [
      { prompt: 'The University of Rochester is a place where curiosity and creativity meet. How will you combine our academic flexibility and co-curricular opportunities to create an experience that reflects your interests and ambitions?', wordLimit: 250 },
    ],
    cycle: '2025-26',
    sourceNote: 'University of Rochester Admissions dates & deadlines page [Acceptance rate/SAT/ACT verified against IPEDS Fall 2024 cohort, nces.ed.gov/collegenavigator.]',
  },
}
