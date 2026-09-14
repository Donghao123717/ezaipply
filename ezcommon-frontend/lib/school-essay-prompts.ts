/**
 * Supplemental essay prompts for schools outside the researched Top 50 in
 * lib/school-admissions-data.ts.
 *
 * Two files, because they answer different questions. That one is a full
 * admissions record - acceptance rate, score bands, deadlines - cross-checked
 * against IPEDS. This one carries prompts alone, for schools where the prompts
 * were verified but the rest of that record was not. Inventing deadlines to
 * fill out a shared shape would be worse than keeping them apart.
 *
 * `noSupplement` is load-bearing and distinct from an empty list: a growing
 * number of schools have dropped their supplement, and showing a student a
 * placeholder essay for a school that asks for none wastes real work. Where we
 * simply do not know, the school is absent from this file entirely and the
 * caller falls back to a labelled placeholder.
 *
 * Prompts are paraphrase-free where a single prompt was published, and
 * condensed into one line where a school offers a choose-one set. Re-verify
 * each cycle against the school's own admissions page: schools revise these
 * annually, and several changed for this one.
 */

export interface SchoolEssayPrompts {
  supplements: { prompt: string; wordLimit: number }[]
  /** True when the school requires no supplement at all this cycle. */
  noSupplement?: boolean
  /** Shown to the student when `noSupplement` - explains what they do instead. */
  note?: string
  cycle: string
}

export const SCHOOL_ESSAY_PROMPTS: Record<string, SchoolEssayPrompts> = {
  'Amherst College': {
    supplements: [
      { prompt: 'Option A: Choose one of the provided quotations and respond to the question posed. It is not necessary to research, read, or refer to the texts from which the quotations are taken; Amherst is looking for original, personal responses. (Option B instead submits a graded junior- or senior-year paper - not a lab report, journal entry, creative writing sample or in-class essay.)', wordLimit: 350 },
    ],
    cycle: '2026-27',
  },
  'Arizona State University': {
    supplements: [],
    noSupplement: true,
    note: 'No essay on the general application; Barrett Honors College applicants write a separate supplement.',
    cycle: '2026-27',
  },
  'Auburn University': {
    supplements: [],
    noSupplement: true,
    note: 'No general supplemental essay.',
    cycle: '2026-27',
  },
  'Baylor University': {
    supplements: [
      { prompt: 'Optional: what are you looking for in a university, why do you want to attend Baylor, and how do you see yourself contributing to the Baylor community?', wordLimit: 450 },
    ],
    cycle: '2026-27',
  },
  'Berea College': {
    supplements: [
      { prompt: 'Berea was the first interracial and coeducational college in the South. Explain how that history is meaningful to you in the context of your personal experience.', wordLimit: 170 },
    ],
    cycle: '2026-27',
  },
  'Bowdoin College': {
    supplements: [
      { prompt: 'Optional - choose one: reflect on a line from The Offer of the College that resonates with you and what it means to you; or share anything about the unique experiences and perspectives you would bring to the Bowdoin campus and community, or an experience that required you to navigate across or through difference.', wordLimit: 250 },
      { prompt: 'How did you first learn about Bowdoin? (140 characters)', wordLimit: 25 },
    ],
    cycle: '2026-27',
  },
  'Brandeis University': {
    supplements: [
      { prompt: 'Required of international applicants: What excites you the most about being an international student at Brandeis University? (Brandeis asks no general supplement; this one applies to international applicants, and a separate prompt applies to Myra Kraft Achievers applicants.)', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Bryn Mawr College': {
    supplements: [
      { prompt: 'Bryn Mawr students bring their authentic selves to campus. What do you know about yourself to be true - and what in your background or experience led you to that truth?', wordLimit: 500 },
      { prompt: 'Optional: tell us why you are applying to Bryn Mawr. What about our values, curriculum, community or campus has drawn you to apply?', wordLimit: 300 },
    ],
    cycle: '2026-27',
  },
  'Bucknell University': {
    supplements: [
      { prompt: 'Explain your interest in your first-choice major or undecided status, and your second-choice major should you list one, and why you would choose Bucknell to pursue those interests. (Appears in the Academics section, not Writing.)', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Carleton College': {
    supplements: [],
    noSupplement: true,
    note: 'Dropped its required supplement for 2026-27; the Additional Information section remains available.',
    cycle: '2026-27',
  },
  'Case Western Reserve University': {
    supplements: [
      { prompt: 'Why are you interested in attending Case Western Reserve University? Consider your personal, academic and professional goals, and how CWRU would help you achieve them.', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Claremont McKenna College': {
    supplements: [
      { prompt: 'Why do you want to attend CMC?', wordLimit: 250 },
      { prompt: 'A critical part of fulfilling CMC\'s mission is living out the commitments of CMC\'s Open Academy: Freedom of Expression, Viewpoint Diversity, and Constructive Dialogue. Describe your commitment to listening to and learning from others with viewpoints, perspectives, and life experiences different from your own.', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Clemson University': {
    supplements: [
      { prompt: 'Optional personal statement: tell us about yourself, your background, and/or how you plan to contribute to the campus community if admitted. (Honors College applicants write two additional 650-word essays.)', wordLimit: 650 },
    ],
    cycle: '2026-27',
  },
  'Colby College': {
    supplements: [],
    noSupplement: true,
    note: 'No writing supplement; Colby invites an optional note of interest to the admissions office instead.',
    cycle: '2026-27',
  },
  'Colgate University': {
    supplements: [
      { prompt: 'On Colgate\'s campus, students engage with individuals from a variety of socioeconomic backgrounds, races, ethnicities, religions and perspectives. Share the benefits you see in engaging with a diverse body of students, faculty and staff as part of your Colgate experience.', wordLimit: 250 },
      { prompt: 'Tell us about what inspires you, and why you want to pursue that at Colgate.', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'College of William & Mary': {
    supplements: [
      { prompt: 'Optional - answer up to two of six short prompts: communities important to you; a personal academic interest or career goal; how your family and background shaped you; what led to your interest in W&M; a challenge you have faced; or a tour of your town.', wordLimit: 300 },
    ],
    cycle: '2026-27',
  },
  'Colorado College': {
    supplements: [
      { prompt: 'The Block Plan is built on deep focus - one class at a time, three-and-a-half weeks, fully immersed. Reflect on a time when you experienced that kind of focus.', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Davidson College': {
    supplements: [
      { prompt: 'Being as specific as possible, what interests you most about Davidson College?', wordLimit: 300 },
      { prompt: 'Davidson encourages students to explore curiosities in and out of the classroom. What is a topic, activity or idea that excites you? Tell us why - examples may include hobbies, books, interactions, music, podcasts or movies.', wordLimit: 300 },
    ],
    cycle: '2026-27',
  },
  'DePaul University': {
    supplements: [],
    noSupplement: true,
    note: 'Accepts the Common App, does not require the personal essay, and asks no supplement.',
    cycle: '2026-27',
  },
  'Denison University': {
    supplements: [],
    noSupplement: true,
    note: 'No supplemental essays required.',
    cycle: '2026-27',
  },
  'Drexel University': {
    supplements: [
      { prompt: 'Most applicants write no supplement. Architecture, Architectural Studies, Music Industry and BA/BS+MD Early Assurance applicants write an additional essay on their interest in that field.', wordLimit: 500 },
    ],
    cycle: '2026-27',
  },
  'Fordham University': {
    supplements: [
      { prompt: 'Optional - choose one: what prepares you to live and learn in New York City; a message your future self would send back to you today; or an experience that changed your perspective or moved you to act.', wordLimit: 300 },
    ],
    cycle: '2026-27',
  },
  'George Washington University': {
    supplements: [
      { prompt: 'Optional - choose one: if you had the power to change the course of history in your community or the world, what would you do and why? Or describe a time when you engaged others in meaningful dialogue around an important issue - did the exchange create change, new perspectives, or deeper relationships?', wordLimit: 500 },
    ],
    cycle: '2026-27',
  },
  'Gettysburg College': {
    supplements: [],
    noSupplement: true,
    note: 'No supplemental essays required.',
    cycle: '2026-27',
  },
  'Grinnell College': {
    supplements: [
      { prompt: 'Optional but recommended: Grinnell\'s core values include supporting a diverse community that is respectful, egalitarian and committed to the common good. How might your background, respect for the lived experiences of others, and/or eagerness to be exposed to new perspectives equip you to thrive at Grinnell and serve the common good? (200 word minimum.)', wordLimit: 450 },
    ],
    cycle: '2026-27',
  },
  'Hamilton College': {
    supplements: [
      { prompt: 'In the spirit of Hamilton\'s motto, "Know Thyself," reflect on your unique perspective and how Hamilton might shape it - as well as how your perspective will shape Hamilton.', wordLimit: 350 },
    ],
    cycle: '2026-27',
  },
  'Harvey Mudd College': {
    supplements: [
      { prompt: 'Tell us about your background and your goals, and how Harvey Mudd fits into them.', wordLimit: 500 },
      { prompt: 'What is it about your academic interests that draws you to Harvey Mudd?', wordLimit: 100 },
    ],
    cycle: '2026-27',
  },
  'Haverford College': {
    supplements: [
      { prompt: 'Tell us about a topic or issue that sparks your curiosity and gets you intellectually excited. How do you hope to engage with this topic or issue at Haverford?', wordLimit: 200 },
      { prompt: 'What values do you seek in your next community, and how does Haverford\'s Honor Code resonate with you?', wordLimit: 200 },
    ],
    cycle: '2026-27',
  },
  'Indiana University Bloomington': {
    supplements: [
      { prompt: 'Describe your academic and career plans and any special interest - for example undergraduate research, academic interests, or leadership opportunities - that you are eager to pursue as an undergraduate at Indiana University.', wordLimit: 400 },
    ],
    cycle: '2026-27',
  },
  'Kenyon College': {
    supplements: [],
    noSupplement: true,
    note: 'No supplement for 2026-27; the Common App personal essay only.',
    cycle: '2026-27',
  },
  'Lafayette College': {
    supplements: [
      { prompt: 'Why Lafayette? Be deliberate and specific about your motivation for applying.', wordLimit: 200 },
    ],
    cycle: '2026-27',
  },
  'Macalester College': {
    supplements: [
      { prompt: 'Why Macalester? Show how the college\'s internationalism, multiculturalism and civic engagement align with your own intellectual and personal trajectory.', wordLimit: 300 },
    ],
    cycle: '2026-27',
  },
  'Miami University': {
    supplements: [],
    noSupplement: true,
    note: 'No supplemental essays required (Miami University, Oxford, Ohio).',
    cycle: '2026-27',
  },
  'Michigan State University': {
    supplements: [
      { prompt: 'Tell us about yourself and what you would bring to the MSU community.', wordLimit: 300 },
      { prompt: 'Second required response.', wordLimit: 500 },
    ],
    cycle: '2026-27',
  },
  'Middlebury College': {
    supplements: [],
    noSupplement: true,
    note: 'No college-specific writing supplement for 2026-27.',
    cycle: '2026-27',
  },
  'North Carolina State University': {
    supplements: [
      { prompt: 'Explain why you selected your first-choice academic program and why you are interested in studying it at NC State. (Three supplemental responses are required.)', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Oberlin College': {
    supplements: [],
    noSupplement: true,
    note: 'No supplement for Arts and Sciences applicants. Conservatory Composition and TIMARA applicants write separate essays.',
    cycle: '2026-27',
  },
  'Occidental College': {
    supplements: [
      { prompt: 'Why do you think Occidental is the right place for you to pursue your interests?', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Pennsylvania State University': {
    supplements: [
      { prompt: 'Required: explain how you have spent, or will spend, the time between your high school graduation and your enrollment at Penn State (the Educational Gap Statement).', wordLimit: 300 },
      { prompt: 'Optional: share something about yourself that is not already reflected in your application or academic records - experiences or activities that would reflect positively on your ability to succeed at Penn State.', wordLimit: 650 },
    ],
    cycle: '2026-27',
  },
  'Pepperdine University': {
    supplements: [
      { prompt: 'Pepperdine is a Christian university where all are welcomed and encouraged to challenge each other in the pursuit of truth. Considering that Pepperdine is a Christian university, why are you interested in attending, and how would you contribute to conversations of faith on campus?', wordLimit: 500 },
    ],
    cycle: '2026-27',
  },
  'Pitzer College': {
    supplements: [
      { prompt: 'Why is Pitzer a fit for you? Pitzer\'s core values are social responsibility, intercultural understanding, interdisciplinary learning, student autonomy and environmental sustainability.', wordLimit: 650 },
      { prompt: 'Tell us about your community involvement, or a perspective you would bring to campus.', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Pomona College': {
    supplements: [
      { prompt: 'What draws you to the subject you selected as a potential major?', wordLimit: 150 },
      { prompt: 'Choose one: the values or perspectives you would bring from a community you belong to; an out-of-classroom experience that changed how you think or engage with peers; or how a person or group in your life would describe you.', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Santa Clara University': {
    supplements: [
      { prompt: 'Why are you interested in pursuing the division or major you selected above?', wordLimit: 50 },
      { prompt: 'Optional: name an issue you genuinely care about - local or global - and show how a Santa Clara education would prepare you to address it.', wordLimit: 300 },
    ],
    cycle: '2026-27',
  },
  'Scripps College': {
    supplements: [
      { prompt: 'Why have you chosen to apply to Scripps College?', wordLimit: 200 },
      { prompt: 'Second short response.', wordLimit: 200 },
    ],
    cycle: '2026-27',
  },
  'Smith College': {
    supplements: [
      { prompt: 'Tell us a story about what has shaped you, how those experiences will affect the way you engage with the Smith residential community, and what you hope to learn from your peers.', wordLimit: 400 },
    ],
    cycle: '2026-27',
  },
  'Southern Methodist University': {
    supplements: [
      { prompt: 'SMU appeals to students for a variety of reasons. Why SMU?', wordLimit: 250 },
      { prompt: 'SMU is a diverse and welcoming learning environment shaped by the convergence of ideas and cultures. How will your unique experiences enhance the University, and how will you benefit from this community?', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Swarthmore College': {
    supplements: [
      { prompt: 'What aspects of your self-identity or personal background are most significant to you? Our identities and perspectives are supported and developed by our immediate contexts and lived experiences - in our neighborhoods, families, classrooms, communities of faith, and more.', wordLimit: 250 },
      { prompt: 'Tell us about a topic that has fascinated you recently - either inside or outside of the classroom. What made you curious about this? Has this topic connected across other areas of your interests? How has this experience shaped you and what encourages you to keep exploring?', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Syracuse University': {
    supplements: [
      { prompt: 'Why is Syracuse University a good match for your interests and goals?', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Texas A&M University': {
    supplements: [
      { prompt: 'Tell us your story. What unique opportunities or challenges have you experienced throughout your high school career that have shaped who you are today?', wordLimit: 750 },
      { prompt: 'Describe a life event which you feel has prepared you to be successful in college.', wordLimit: 250 },
      { prompt: 'Why are you interested in the major you indicated, and why Texas A&M? Also describe your life goals and your plans beyond your bachelor\'s degree. (Four 100-word short answers.)', wordLimit: 100 },
    ],
    cycle: '2026-27',
  },
  'Trinity College': {
    supplements: [
      { prompt: 'Think about times when people have been intrigued by, or curious about, your identity, upbringing or background. Show us rather than tell us.', wordLimit: 400 },
    ],
    cycle: '2026-27',
  },
  'Tulane University': {
    supplements: [],
    noSupplement: true,
    note: 'Dropped its supplement for 2026-27; Common App personal essay only.',
    cycle: '2026-27',
  },
  'University of Colorado Boulder': {
    supplements: [
      { prompt: 'What do you hope to study, and why, at CU Boulder?', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'University of Connecticut': {
    supplements: [],
    noSupplement: true,
    note: 'No supplement on the undergraduate application; special programs have their own.',
    cycle: '2026-27',
  },
  'University of Massachusetts Amherst': {
    supplements: [
      { prompt: 'Please tell us why you want to attend UMass Amherst.', wordLimit: 100 },
      { prompt: 'At UMass Amherst, no two students are alike. Our communities and groups often define us and shape our individual worlds - shared geography, religion, race/ethnicity, income, ideology and more. Choose one of your communities or groups and describe its significance.', wordLimit: 100 },
      { prompt: 'Why did you choose your major?', wordLimit: 100 },
    ],
    cycle: '2026-27',
  },
  'University of Miami': {
    supplements: [],
    noSupplement: true,
    note: 'No writing supplement for 2026-27; Common App personal essay only.',
    cycle: '2026-27',
  },
  'University of Minnesota Twin Cities': {
    supplements: [
      { prompt: 'Tell us about your academic and career interests. The U of M has eight freshman-admitting colleges and more than 150 majors - share a few words about what you\'d like to study, career paths that interest you, or your favourite subjects in school. (1,000 characters.)', wordLimit: 150 },
    ],
    cycle: '2026-27',
  },
  'University of Pittsburgh': {
    supplements: [
      { prompt: 'A personal statement is required to be considered for scholarships, Frederick Honors College review, or if applying test-optional; international applicants answer a separate prompt in place of it. There is no supplement that applies to every applicant.', wordLimit: 650 },
    ],
    cycle: '2026-27',
  },
  'University of Richmond': {
    supplements: [
      { prompt: 'Choose one: tell us about a time you made a space better for other people by helping them feel welcome, heard, included or supported; a time you learned by doing, making, building, testing, helping or leading, and what it taught you; or the communities, experiences or ambitions that shaped you into the unique person you are and how you will make your mark as part of a Spider community.', wordLimit: 650 },
    ],
    cycle: '2026-27',
  },
  'Vassar College': {
    supplements: [
      { prompt: 'Choose one: tell us a little bit about an important part of your identity and how it has shaped your life and/or interactions with others; or tell us about the community (or communities) you come from and how it has shaped your lived experiences and identity.', wordLimit: 300 },
    ],
    cycle: '2026-27',
  },
  'Villanova University': {
    supplements: [
      { prompt: 'Choose one: (1) What have you done to play your part in advancing equity and justice in your community? (2) What is a lesson in life that you have learned that you would want to share with others at Villanova? (3) "Villanova" means "new home." Why do you want to call Villanova your new home? (4) Tell us about a time you were misjudged. (5) Tell us about a time someone lent you their strength.', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Wake Forest University': {
    supplements: [
      { prompt: 'Why have you decided to apply to Wake Forest? Please be brief but not trivial.', wordLimit: 100 },
      { prompt: 'Optional, choose one: tell us what piques your intellectual curiosity or has helped you understand the world\'s complexity - this can include a work you\'ve read, a project you\'ve completed for a class, or a co-curricular activity.', wordLimit: 150 },
    ],
    cycle: '2026-27',
  },
  'Washington and Lee University': {
    supplements: [
      { prompt: 'Describe how you have familiarised yourself with W&L and what aspects of its community are most exciting to you.', wordLimit: 250 },
      { prompt: 'Choose one of four prompts, answered either as a 250-word statement or a two-minute recorded video.', wordLimit: 250 },
    ],
    cycle: '2026-27',
  },
  'Wellesley College': {
    supplements: [
      { prompt: 'Tell us about an experience working with and alongside people of different backgrounds and/or perspectives from your own. Why was this important to you, and what lessons from it will you bring to Wellesley?', wordLimit: 400 },
    ],
    cycle: '2026-27',
  },
  'Wesleyan University': {
    supplements: [],
    noSupplement: true,
    note: 'No school-specific writing supplement for 2026-27; the Common App personal statement only.',
    cycle: '2026-27',
  },
  'Whitman College': {
    supplements: [],
    noSupplement: true,
    note: 'No supplement for 2026-27; the Common App personal statement is the only writing.',
    cycle: '2026-27',
  },
  'Williams College': {
    supplements: [
      { prompt: 'Optional: Williams requires no writing supplement. If you wish, share a 3-5 page academic paper (excluding citations) written in the last year - creative or analytical, any topic, need not be graded. Include a description of the assignment; do not submit lab reports.', wordLimit: 2000 },
    ],
    cycle: '2026-27',
  },
}
