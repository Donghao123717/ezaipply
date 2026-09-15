/**
 * What a school is like to attend, and what it costs an international student.
 *
 * The recommender used to know one thing about each school: its overall
 * acceptance rate. That is enough to sort schools by how hard they are to get
 * into and nothing else, which is why every student got the same list. This
 * file is the rest of the picture - where the school is, how big it is, what
 * it costs, what its graduates do next, and which programmes it is actually
 * known for.
 *
 * On provenance, plainly: these are estimates from general knowledge of each
 * school, not a certified feed. Cost figures are the order of magnitude a
 * student will see as estimated annual expenses on an I-20 - accurate enough
 * to separate a $45k public from a $92k private, not to budget against. The
 * UI says so wherever a number is shown. Swap in IPEDS/College Scorecard when
 * this ships for real; the shape below is what that import should produce.
 */

export type Setting = 'urban' | 'suburban' | 'college-town' | 'rural'
export type Region = 'northeast' | 'mid-atlantic' | 'south' | 'midwest' | 'mountain' | 'west'
export type Outcome = 'industry' | 'graduate-school' | 'balanced'
/** Whether an international student can realistically win merit money here. */
export type MeritAid = 'meaningful' | 'limited' | 'none'

export interface SchoolFit {
  city: string
  state: string
  region: Region
  /** Within about an hour of an ocean coast. */
  coastal: boolean
  setting: Setting
  /** Undergraduate enrolment, thousands. Drives the big-lecture vs seminar feel. */
  undergrad: number
  studentFacultyRatio: number
  /** Estimated total annual cost for an international student, USD thousands. */
  costPerYear: number
  outcome: Outcome
  meritAid: MeritAid
  /** Fields this school is genuinely known for. Empty means no standout claim. */
  strongPrograms: string[]
}

/** Winter severity by state, which is what students actually mean by "weather". */
const COLD_STATES = new Set(['ME', 'VT', 'NH', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'MI', 'WI', 'MN', 'IA', 'IL', 'IN', 'OH', 'ND', 'SD', 'NE', 'MT', 'WY', 'CO', 'UT', 'AK'])
const WARM_STATES = new Set(['FL', 'TX', 'AZ', 'CA', 'HI', 'LA', 'GA', 'SC', 'AL', 'MS', 'NV', 'NM'])

export type Climate = 'cold-winters' | 'mild' | 'warm'

export function climateOf(state: string): Climate {
  if (COLD_STATES.has(state)) return 'cold-winters'
  if (WARM_STATES.has(state)) return 'warm'
  return 'mild'
}

const REGION_BY_STATE: Record<string, Region> = {
  ME: 'northeast', NH: 'northeast', VT: 'northeast', MA: 'northeast', RI: 'northeast', CT: 'northeast',
  NY: 'northeast', NJ: 'mid-atlantic', PA: 'mid-atlantic', DE: 'mid-atlantic', MD: 'mid-atlantic', DC: 'mid-atlantic', VA: 'mid-atlantic', WV: 'mid-atlantic',
  NC: 'south', SC: 'south', GA: 'south', FL: 'south', AL: 'south', MS: 'south', TN: 'south', KY: 'south', AR: 'south', LA: 'south', TX: 'south', OK: 'south',
  OH: 'midwest', MI: 'midwest', IN: 'midwest', IL: 'midwest', WI: 'midwest', MN: 'midwest', IA: 'midwest', MO: 'midwest', KS: 'midwest', NE: 'midwest', ND: 'midwest', SD: 'midwest',
  CO: 'mountain', UT: 'mountain', MT: 'mountain', WY: 'mountain', ID: 'mountain', NV: 'mountain', AZ: 'mountain', NM: 'mountain',
  CA: 'west', OR: 'west', WA: 'west', AK: 'west', HI: 'west',
}

/**
 * [name, city, state, undergrad(k), cost($k), student:faculty, setting,
 *  coastal, outcome, merit aid, strong programmes]
 *
 * Setting codes: u urban, s suburban, t college town, r rural.
 * Outcome codes: i industry-heavy, g graduate-school-heavy, b balanced.
 * Merit codes:   m meaningful for internationals, l limited, n none.
 */
type Row = [string, string, string, number, number, number, 'u' | 's' | 't' | 'r', 0 | 1, 'i' | 'g' | 'b', 'm' | 'l' | 'n', string[]]

const SETTINGS: Record<string, Setting> = { u: 'urban', s: 'suburban', t: 'college-town', r: 'rural' }
const OUTCOMES: Record<string, Outcome> = { i: 'industry', g: 'graduate-school', b: 'balanced' }
const MERIT: Record<string, MeritAid> = { m: 'meaningful', l: 'limited', n: 'none' }

const ROWS: Row[] = [
  ['American University', 'Washington', 'DC', 8, 82, 12, 'u', 0, 'b', 'l', ['政治/国际关系', '传播']],
  ['Amherst College', 'Amherst', 'MA', 2, 90, 7, 't', 0, 'g', 'n', ['经济', '人文']],
  ['Arizona State University', 'Tempe', 'AZ', 65, 58, 19, 'u', 0, 'i', 'm', ['工程', '商科', '传播']],
  ['Auburn University', 'Auburn', 'AL', 26, 52, 19, 't', 0, 'i', 'm', ['工程', '农业']],
  ['Baylor University', 'Waco', 'TX', 15, 72, 15, 't', 0, 'b', 'm', ['商科', '护理/医预']],
  ['Berea College', 'Berea', 'KY', 2, 8, 10, 'r', 0, 'b', 'm', ['人文']],
  ['Binghamton University', 'Binghamton', 'NY', 14, 47, 19, 's', 0, 'b', 'l', ['商科', '工程']],
  ['Boston College', 'Chestnut Hill', 'MA', 10, 90, 12, 's', 1, 'b', 'l', ['商科', '政治']],
  ['Boston University', 'Boston', 'MA', 18, 90, 10, 'u', 1, 'i', 'l', ['传播', '商科', '工程']],
  ['Bowdoin College', 'Brunswick', 'ME', 2, 88, 9, 't', 1, 'g', 'n', ['人文', '环境']],
  ['Brandeis University', 'Waltham', 'MA', 4, 88, 10, 's', 1, 'g', 'm', ['生物', '经济']],
  ['Brigham Young University', 'Provo', 'UT', 32, 25, 20, 't', 0, 'i', 'm', ['会计', '商科']],
  ['Brown University', 'Providence', 'RI', 7, 92, 6, 'u', 1, 'g', 'n', ['计算机', '人文', '医预']],
  ['Bryn Mawr College', 'Bryn Mawr', 'PA', 1, 85, 8, 's', 0, 'g', 'l', ['人文', '生物']],
  ['Bucknell University', 'Lewisburg', 'PA', 4, 88, 9, 'r', 0, 'b', 'l', ['工程', '商科']],
  ['California Institute of Technology', 'Pasadena', 'CA', 1, 88, 3, 's', 1, 'g', 'n', ['物理', '工程', '计算机']],
  ['California State University, Fullerton', 'Fullerton', 'CA', 37, 45, 24, 'u', 1, 'i', 'l', ['商科', '传播']],
  ['California State University, Long Beach', 'Long Beach', 'CA', 34, 45, 24, 'u', 1, 'i', 'l', ['工程', '艺术']],
  ['Carleton College', 'Northfield', 'MN', 2, 86, 9, 't', 0, 'g', 'n', ['人文', '计算机']],
  ['Carnegie Mellon University', 'Pittsburgh', 'PA', 8, 90, 10, 'u', 0, 'i', 'l', ['计算机', '工程', '戏剧/设计']],
  ['Case Western Reserve University', 'Cleveland', 'OH', 6, 84, 11, 'u', 0, 'b', 'm', ['工程', '生物医学', '医预']],
  ['Chapman University', 'Orange', 'CA', 8, 82, 13, 's', 1, 'i', 'm', ['影视', '商科']],
  ['Claremont McKenna College', 'Claremont', 'CA', 1, 88, 8, 's', 0, 'i', 'l', ['经济', '政治']],
  ['Clark University', 'Worcester', 'MA', 2, 76, 10, 'u', 0, 'g', 'm', ['心理', '地理']],
  ['Clarkson University', 'Potsdam', 'NY', 3, 74, 13, 'r', 0, 'i', 'm', ['工程']],
  ['Clemson University', 'Clemson', 'SC', 22, 60, 16, 't', 0, 'i', 'l', ['工程', '商科']],
  ['Colby College', 'Waterville', 'ME', 2, 86, 9, 't', 0, 'g', 'n', ['人文', '环境']],
  ['Colgate University', 'Hamilton', 'NY', 3, 89, 9, 'r', 0, 'b', 'n', ['经济', '人文']],
  ['College of William & Mary', 'Williamsburg', 'VA', 7, 73, 12, 't', 1, 'g', 'l', ['商科', '政治']],
  ['Colorado College', 'Colorado Springs', 'CO', 2, 85, 9, 's', 0, 'g', 'l', ['环境', '人文']],
  ['Colorado School of Mines', 'Golden', 'CO', 6, 63, 16, 's', 0, 'i', 'm', ['工程', '地球科学']],
  ['Columbia University', 'New York', 'NY', 9, 93, 6, 'u', 1, 'g', 'n', ['商科', '工程', '人文']],
  ['Cornell University', 'Ithaca', 'NY', 16, 92, 9, 't', 0, 'b', 'n', ['工程', '商科', '农业', '建筑']],
  ['Creighton University', 'Omaha', 'NE', 4, 65, 11, 'u', 0, 'b', 'm', ['医预', '护理', '商科']],
  ['CUNY City College', 'New York', 'NY', 13, 35, 16, 'u', 1, 'i', 'l', ['工程', '建筑']],
  ['Dartmouth College', 'Hanover', 'NH', 5, 92, 7, 'r', 0, 'b', 'n', ['经济', '工程', '人文']],
  ['Davidson College', 'Davidson', 'NC', 2, 85, 9, 's', 0, 'g', 'l', ['人文', '经济']],
  ['Denison University', 'Granville', 'OH', 2, 82, 9, 'r', 0, 'b', 'm', ['人文', '经济']],
  ['DePaul University', 'Chicago', 'IL', 14, 62, 15, 'u', 0, 'i', 'm', ['商科', '计算机', '影视']],
  ['Drexel University', 'Philadelphia', 'PA', 15, 82, 10, 'u', 0, 'i', 'm', ['工程', '商科', '设计']],
  ['Duke University', 'Durham', 'NC', 7, 92, 8, 's', 0, 'g', 'n', ['生物', '公共政策', '工程']],
  ['Elon University', 'Elon', 'NC', 6, 62, 12, 's', 0, 'b', 'm', ['传播', '商科']],
  ['Emory University', 'Atlanta', 'GA', 7, 88, 9, 's', 0, 'g', 'l', ['商科', '生物/医预', '护理']],
  ['Fairfield University', 'Fairfield', 'CT', 5, 82, 12, 's', 1, 'b', 'm', ['商科', '护理']],
  ['Florida International University', 'Miami', 'FL', 43, 40, 22, 'u', 1, 'i', 'l', ['商科', '酒店管理', '工程']],
  ['Florida State University', 'Tallahassee', 'FL', 33, 42, 18, 't', 0, 'b', 'l', ['商科', '影视', '刑侦']],
  ['Fordham University', 'New York', 'NY', 10, 88, 13, 'u', 1, 'b', 'm', ['商科', '传播', '政治']],
  ['George Mason University', 'Fairfax', 'VA', 27, 55, 17, 's', 0, 'i', 'l', ['计算机', '政治', '商科']],
  ['George Washington University', 'Washington', 'DC', 11, 88, 13, 'u', 0, 'b', 'm', ['政治/国际关系', '商科']],
  ['Georgetown University', 'Washington', 'DC', 8, 90, 11, 'u', 0, 'b', 'n', ['国际关系', '商科', '政治']],
  ['Georgia Institute of Technology', 'Atlanta', 'GA', 19, 54, 19, 'u', 0, 'i', 'l', ['工程', '计算机', '商科']],
  ['Gettysburg College', 'Gettysburg', 'PA', 2, 82, 9, 'r', 0, 'b', 'm', ['人文', '政治']],
  ['Gonzaga University', 'Spokane', 'WA', 5, 70, 11, 'u', 0, 'b', 'm', ['商科', '工程', '护理']],
  ['Grinnell College', 'Grinnell', 'IA', 2, 84, 9, 'r', 0, 'g', 'm', ['人文', '计算机']],
  ['Hamilton College', 'Clinton', 'NY', 2, 88, 9, 'r', 0, 'g', 'n', ['人文', '经济']],
  ['Harvard University', 'Cambridge', 'MA', 7, 92, 7, 'u', 1, 'g', 'n', ['经济', '计算机', '人文', '医预']],
  ['Harvey Mudd College', 'Claremont', 'CA', 1, 92, 8, 's', 0, 'i', 'n', ['工程', '计算机', '物理']],
  ['Haverford College', 'Haverford', 'PA', 1, 88, 9, 's', 0, 'g', 'n', ['人文', '生物']],
  ['Howard University', 'Washington', 'DC', 10, 60, 13, 'u', 0, 'b', 'm', ['医预', '商科', '传播']],
  ['Illinois Institute of Technology', 'Chicago', 'IL', 3, 68, 12, 'u', 0, 'i', 'm', ['工程', '建筑', '计算机']],
  ['Indiana University Bloomington', 'Bloomington', 'IN', 36, 60, 17, 't', 0, 'b', 'm', ['商科', '音乐', '公共事务']],
  ['Iowa State University', 'Ames', 'IA', 25, 46, 18, 't', 0, 'i', 'm', ['工程', '农业', '设计']],
  ['Johns Hopkins University', 'Baltimore', 'MD', 6, 90, 6, 'u', 1, 'g', 'l', ['生物医学', '公共卫生', '国际关系']],
  ['Kenyon College', 'Gambier', 'OH', 2, 86, 9, 'r', 0, 'g', 'm', ['英语/写作', '人文']],
  ['Lafayette College', 'Easton', 'PA', 3, 88, 9, 's', 0, 'b', 'l', ['工程', '经济']],
  ['Lehigh University', 'Bethlehem', 'PA', 6, 88, 9, 's', 0, 'i', 'l', ['工程', '商科']],
  ['Loyola Marymount University', 'Los Angeles', 'CA', 7, 82, 11, 'u', 1, 'b', 'm', ['影视', '商科']],
  ['Loyola University Chicago', 'Chicago', 'IL', 12, 68, 14, 'u', 0, 'b', 'm', ['护理', '商科', '医预']],
  ['Macalester College', 'Saint Paul', 'MN', 2, 84, 10, 'u', 0, 'g', 'm', ['国际关系', '经济']],
  ['Marquette University', 'Milwaukee', 'WI', 8, 68, 14, 'u', 0, 'b', 'm', ['商科', '工程', '护理']],
  ['Massachusetts Institute of Technology', 'Cambridge', 'MA', 5, 88, 3, 'u', 1, 'g', 'n', ['工程', '计算机', '物理', '商科']],
  ['Miami University', 'Oxford', 'OH', 17, 56, 16, 't', 0, 'b', 'm', ['商科', '建筑']],
  ['Michigan State University', 'East Lansing', 'MI', 40, 58, 17, 't', 0, 'i', 'm', ['供应链', '农业', '教育']],
  ['Middlebury College', 'Middlebury', 'VT', 3, 88, 8, 'r', 0, 'g', 'n', ['语言', '环境', '人文']],
  ['New Jersey Institute of Technology', 'Newark', 'NJ', 9, 52, 16, 'u', 0, 'i', 'm', ['工程', '计算机', '建筑']],
  ['New York University', 'New York', 'NY', 29, 93, 8, 'u', 1, 'i', 'l', ['商科', '艺术', '影视']],
  ['North Carolina State University', 'Raleigh', 'NC', 26, 50, 13, 'u', 0, 'i', 'l', ['工程', '设计', '农业']],
  ['Northeastern University', 'Boston', 'MA', 16, 90, 14, 'u', 1, 'i', 'l', ['工程', '商科', '计算机']],
  ['Northwestern University', 'Evanston', 'IL', 8, 92, 6, 's', 0, 'g', 'n', ['传播/新闻', '工程', '商科']],
  ['Oberlin College', 'Oberlin', 'OH', 3, 88, 9, 'r', 0, 'g', 'm', ['音乐', '人文']],
  ['Occidental College', 'Los Angeles', 'CA', 2, 84, 9, 'u', 1, 'g', 'l', ['人文', '政治']],
  ['Ohio State University', 'Columbus', 'OH', 46, 56, 17, 'u', 0, 'i', 'm', ['商科', '工程', '医预']],
  ['Oregon State University', 'Corvallis', 'OR', 26, 48, 18, 't', 0, 'i', 'm', ['工程', '林业/海洋']],
  ['Pennsylvania State University', 'University Park', 'PA', 41, 60, 15, 't', 0, 'i', 'l', ['工程', '商科']],
  ['Pepperdine University', 'Malibu', 'CA', 4, 85, 12, 's', 1, 'b', 'm', ['商科', '传播']],
  ['Pitzer College', 'Claremont', 'CA', 1, 86, 10, 's', 0, 'g', 'n', ['环境', '社会科学']],
  ['Pomona College', 'Claremont', 'CA', 2, 88, 7, 's', 0, 'g', 'n', ['人文', '经济', '计算机']],
  ['Princeton University', 'Princeton', 'NJ', 5, 90, 5, 's', 0, 'g', 'n', ['工程', '公共政策', '人文']],
  ['Purdue University', 'West Lafayette', 'IN', 38, 52, 15, 't', 0, 'i', 'm', ['工程', '计算机', '农业']],
  ['Rensselaer Polytechnic Institute', 'Troy', 'NY', 6, 88, 13, 's', 0, 'i', 'm', ['工程', '计算机']],
  ['Rice University', 'Houston', 'TX', 4, 82, 6, 'u', 0, 'g', 'l', ['工程', '音乐', '自然科学']],
  ['Rochester Institute of Technology', 'Rochester', 'NY', 14, 78, 13, 's', 0, 'i', 'm', ['计算机', '工程', '设计']],
  ['Rutgers University', 'New Brunswick', 'NJ', 36, 58, 15, 's', 0, 'b', 'l', ['工程', '商科', '药学']],
  ['Rutgers University, Camden', 'Camden', 'NJ', 5, 50, 13, 'u', 0, 'b', 'l', ['商科', '护理']],
  ['Rutgers University, Newark', 'Newark', 'NJ', 7, 50, 14, 'u', 0, 'b', 'l', ['商科', '刑侦']],
  ['Saint Louis University', 'St. Louis', 'MO', 8, 68, 9, 'u', 0, 'b', 'm', ['医预', '护理', '商科']],
  ['San Diego State University', 'San Diego', 'CA', 32, 48, 25, 'u', 1, 'i', 'l', ['商科', '工程']],
  ['Santa Clara University', 'Santa Clara', 'CA', 6, 88, 11, 's', 1, 'i', 'l', ['工程', '商科', '计算机']],
  ['Scripps College', 'Claremont', 'CA', 1, 87, 10, 's', 0, 'g', 'l', ['人文', '艺术']],
  ['Smith College', 'Northampton', 'MA', 3, 88, 8, 't', 0, 'g', 'l', ['人文', '工程']],
  ['Southern Methodist University', 'Dallas', 'TX', 7, 88, 11, 's', 0, 'i', 'm', ['商科', '工程', '艺术']],
  ['Stanford University', 'Stanford', 'CA', 8, 90, 5, 's', 1, 'g', 'n', ['计算机', '工程', '商科']],
  ['Stevens Institute of Technology', 'Hoboken', 'NJ', 4, 85, 11, 'u', 1, 'i', 'm', ['工程', '计算机', '金融']],
  ['Stony Brook University', 'Stony Brook', 'NY', 18, 50, 18, 's', 1, 'g', 'l', ['计算机', '工程', '医预']],
  ['Swarthmore College', 'Swarthmore', 'PA', 2, 90, 8, 's', 0, 'g', 'n', ['人文', '工程']],
  ['Syracuse University', 'Syracuse', 'NY', 16, 85, 15, 'u', 0, 'i', 'm', ['传播/新闻', '建筑', '商科']],
  ['Temple University', 'Philadelphia', 'PA', 24, 58, 14, 'u', 0, 'i', 'm', ['商科', '传播', '影视']],
  ['Texas A&M University', 'College Station', 'TX', 58, 52, 19, 't', 0, 'i', 'l', ['工程', '农业', '商科']],
  ['Texas Christian University', 'Fort Worth', 'TX', 10, 80, 13, 's', 0, 'b', 'm', ['商科', '护理', '传播']],
  ['Thomas Jefferson University', 'Philadelphia', 'PA', 3, 72, 12, 'u', 0, 'i', 'm', ['设计/时尚', '健康科学']],
  ['Touro University', 'New York', 'NY', 5, 45, 13, 'u', 1, 'b', 'm', ['健康科学', '商科']],
  ['Trinity College', 'Hartford', 'CT', 2, 88, 9, 'u', 0, 'b', 'l', ['人文', '工程']],
  ['Tufts University', 'Medford', 'MA', 7, 90, 9, 's', 1, 'g', 'n', ['国际关系', '工程', '生物']],
  ['Tulane University', 'New Orleans', 'LA', 8, 88, 8, 'u', 1, 'b', 'm', ['商科', '公共卫生', '建筑']],
  ['Union College', 'Schenectady', 'NY', 2, 86, 9, 's', 0, 'b', 'm', ['工程', '人文']],
  ['University at Albany', 'Albany', 'NY', 13, 46, 18, 's', 0, 'b', 'l', ['公共政策', '计算机']],
  ['University at Buffalo', 'Buffalo', 'NY', 21, 48, 14, 's', 0, 'i', 'l', ['工程', '商科', '医预']],
  ['University of Alabama at Birmingham', 'Birmingham', 'AL', 12, 44, 18, 'u', 0, 'b', 'm', ['医预', '护理', '公共卫生']],
  ['University of Arizona', 'Tucson', 'AZ', 39, 54, 16, 'u', 0, 'i', 'm', ['工程', '天文', '商科']],
  ['University of California, Berkeley', 'Berkeley', 'CA', 33, 76, 19, 'u', 1, 'g', 'n', ['工程', '计算机', '商科']],
  ['University of California, Davis', 'Davis', 'CA', 32, 74, 20, 't', 0, 'b', 'n', ['农业', '兽医', '工程']],
  ['University of California, Irvine', 'Irvine', 'CA', 30, 74, 18, 's', 1, 'b', 'n', ['计算机', '商科', '生物']],
  ['University of California, Los Angeles', 'Los Angeles', 'CA', 33, 75, 18, 'u', 1, 'g', 'n', ['工程', '商科', '影视']],
  ['University of California, Merced', 'Merced', 'CA', 9, 70, 19, 'r', 0, 'b', 'n', ['工程', '环境']],
  ['University of California, Riverside', 'Riverside', 'CA', 23, 72, 22, 's', 0, 'b', 'n', ['商科', '工程']],
  ['University of California, San Diego', 'La Jolla', 'CA', 33, 75, 19, 's', 1, 'g', 'n', ['生物', '工程', '计算机']],
  ['University of California, Santa Barbara', 'Santa Barbara', 'CA', 23, 74, 18, 's', 1, 'b', 'n', ['工程', '经济', '海洋']],
  ['University of California, Santa Cruz', 'Santa Cruz', 'CA', 18, 72, 20, 't', 1, 'b', 'n', ['计算机', '天文', '环境']],
  ['University of Central Florida', 'Orlando', 'FL', 60, 42, 20, 's', 0, 'i', 'l', ['工程', '酒店管理', '计算机']],
  ['University of Chicago', 'Chicago', 'IL', 7, 92, 5, 'u', 0, 'g', 'n', ['经济', '人文', '数学']],
  ['University of Colorado Boulder', 'Boulder', 'CO', 30, 60, 18, 't', 0, 'i', 'm', ['工程', '航天', '环境']],
  ['University of Connecticut', 'Storrs', 'CT', 19, 58, 16, 'r', 0, 'b', 'l', ['工程', '商科', '护理']],
  ['University of Dayton', 'Dayton', 'OH', 8, 62, 14, 's', 0, 'i', 'm', ['工程', '商科']],
  ['University of Delaware', 'Newark', 'DE', 19, 56, 15, 't', 1, 'b', 'm', ['工程', '商科', '化工']],
  ['University of Denver', 'Denver', 'CO', 6, 78, 11, 'u', 0, 'b', 'm', ['商科', '国际关系']],
  ['University of Florida', 'Gainesville', 'FL', 34, 48, 17, 't', 0, 'i', 'l', ['工程', '商科', '农业']],
  ['University of Georgia', 'Athens', 'GA', 31, 50, 17, 't', 0, 'i', 'l', ['商科', '传播', '农业']],
  ['University of Houston', 'Houston', 'TX', 38, 42, 21, 'u', 1, 'i', 'l', ['工程', '商科', '酒店管理']],
  ['University of Illinois Chicago', 'Chicago', 'IL', 22, 50, 18, 'u', 0, 'b', 'l', ['医预', '工程', '护理']],
  ['University of Illinois Urbana-Champaign', 'Urbana', 'IL', 35, 62, 20, 't', 0, 'i', 'l', ['工程', '计算机', '会计']],
  ['University of Iowa', 'Iowa City', 'IA', 22, 48, 15, 't', 0, 'b', 'm', ['写作', '商科', '医预']],
  ['University of Kansas', 'Lawrence', 'KS', 19, 46, 17, 't', 0, 'b', 'm', ['工程', '商科', '新闻']],
  ['University of Kentucky', 'Lexington', 'KY', 23, 46, 16, 'u', 0, 'b', 'm', ['工程', '医预', '商科']],
  ['University of Maryland Baltimore County', 'Baltimore', 'MD', 11, 48, 18, 's', 1, 'g', 'm', ['计算机', '生物', '工程']],
  ['University of Maryland, College Park', 'College Park', 'MD', 31, 58, 15, 's', 0, 'i', 'l', ['计算机', '工程', '商科']],
  ['University of Massachusetts Amherst', 'Amherst', 'MA', 24, 58, 17, 't', 0, 'b', 'l', ['计算机', '工程', '商科']],
  ['University of Miami', 'Coral Gables', 'FL', 12, 88, 12, 's', 1, 'b', 'm', ['商科', '海洋', '传播']],
  ['University of Michigan', 'Ann Arbor', 'MI', 33, 78, 11, 't', 0, 'b', 'l', ['工程', '商科', '计算机']],
  ['University of Minnesota Twin Cities', 'Minneapolis', 'MN', 36, 52, 17, 'u', 0, 'i', 'm', ['工程', '商科', '医预']],
  ['University of Missouri', 'Columbia', 'MO', 24, 44, 18, 't', 0, 'b', 'm', ['新闻', '商科', '工程']],
  ['University of New Hampshire', 'Durham', 'NH', 12, 52, 17, 't', 1, 'b', 'm', ['工程', '商科', '海洋']],
  ['University of North Carolina at Chapel Hill', 'Chapel Hill', 'NC', 20, 62, 15, 't', 0, 'g', 'l', ['商科', '公共卫生', '传播']],
  ['University of North Carolina at Charlotte', 'Charlotte', 'NC', 24, 44, 18, 's', 0, 'i', 'l', ['工程', '商科', '计算机']],
  ['University of Notre Dame', 'Notre Dame', 'IN', 9, 88, 9, 's', 0, 'b', 'n', ['商科', '工程', '建筑']],
  ['University of Oklahoma', 'Norman', 'OK', 22, 44, 18, 't', 0, 'i', 'm', ['工程', '气象', '商科']],
  ['University of Oregon', 'Eugene', 'OR', 20, 56, 18, 't', 0, 'b', 'm', ['新闻', '商科', '建筑']],
  ['University of Pennsylvania', 'Philadelphia', 'PA', 10, 92, 6, 'u', 0, 'i', 'n', ['商科', '工程', '护理']],
  ['University of Pittsburgh', 'Pittsburgh', 'PA', 20, 60, 14, 'u', 0, 'b', 'm', ['医预', '工程', '哲学']],
  ['University of Richmond', 'Richmond', 'VA', 3, 85, 8, 's', 0, 'b', 'm', ['商科', '政治']],
  ['University of Rochester', 'Rochester', 'NY', 6, 88, 10, 's', 0, 'g', 'm', ['音乐', '光学', '生物医学']],
  ['University of San Diego', 'San Diego', 'CA', 6, 85, 13, 's', 1, 'b', 'm', ['商科', '工程', '国际关系']],
  ['University of San Francisco', 'San Francisco', 'CA', 6, 82, 14, 'u', 1, 'b', 'm', ['商科', '护理', '计算机']],
  ['University of South Carolina', 'Columbia', 'SC', 27, 50, 17, 'u', 0, 'i', 'm', ['国际商务', '酒店管理']],
  ['University of South Florida', 'Tampa', 'FL', 37, 42, 21, 'u', 1, 'i', 'l', ['工程', '医预', '商科']],
  ['University of Southern California', 'Los Angeles', 'CA', 21, 92, 9, 'u', 1, 'i', 'l', ['影视', '工程', '商科']],
  ['University of Tennessee, Knoxville', 'Knoxville', 'TN', 26, 48, 16, 'u', 0, 'i', 'm', ['工程', '商科', '农业']],
  ['University of Texas at Austin', 'Austin', 'TX', 42, 58, 18, 'u', 0, 'i', 'l', ['工程', '商科', '计算机']],
  ['University of Texas at Dallas', 'Richardson', 'TX', 22, 44, 23, 's', 0, 'i', 'm', ['计算机', '工程', '商科']],
  ['University of the Pacific', 'Stockton', 'CA', 3, 78, 12, 's', 0, 'b', 'm', ['牙医预科', '药学', '工程']],
  ['University of Vermont', 'Burlington', 'VT', 12, 62, 16, 't', 0, 'b', 'm', ['环境', '护理', '医预']],
  ['University of Virginia', 'Charlottesville', 'VA', 17, 72, 15, 't', 0, 'b', 'l', ['商科', '工程', '政治']],
  ['University of Washington', 'Seattle', 'WA', 36, 62, 19, 'u', 1, 'i', 'l', ['计算机', '工程', '商科']],
  ['University of Wisconsin-Madison', 'Madison', 'WI', 35, 62, 17, 'u', 0, 'i', 'l', ['工程', '商科', '计算机']],
  ['Vanderbilt University', 'Nashville', 'TN', 7, 92, 7, 'u', 0, 'g', 'm', ['教育', '工程', '音乐']],
  ['Vassar College', 'Poughkeepsie', 'NY', 2, 88, 8, 's', 0, 'g', 'n', ['人文', '艺术']],
  ['Villanova University', 'Villanova', 'PA', 7, 88, 11, 's', 0, 'i', 'm', ['商科', '工程', '护理']],
  ['Virginia Commonwealth University', 'Richmond', 'VA', 21, 48, 17, 'u', 0, 'i', 'm', ['艺术/设计', '医预', '护理']],
  ['Virginia Tech', 'Blacksburg', 'VA', 30, 52, 14, 't', 0, 'i', 'l', ['工程', '建筑', '商科']],
  ['Wake Forest University', 'Winston-Salem', 'NC', 5, 90, 10, 's', 0, 'b', 'l', ['商科', '医预']],
  ['Washington and Lee University', 'Lexington', 'VA', 2, 86, 8, 'r', 0, 'b', 'm', ['商科', '人文']],
  ['Washington University in St. Louis', 'St. Louis', 'MO', 8, 90, 7, 's', 0, 'g', 'm', ['生物/医预', '商科', '建筑']],
  ['Wellesley College', 'Wellesley', 'MA', 2, 88, 7, 's', 1, 'g', 'n', ['人文', '经济']],
  ['Wesleyan University', 'Middletown', 'CT', 3, 88, 8, 's', 0, 'g', 'n', ['人文', '影视']],
  ['Wheaton College', 'Norton', 'MA', 2, 78, 10, 's', 1, 'b', 'm', ['人文', '心理']],
  ['Whitman College', 'Walla Walla', 'WA', 2, 82, 9, 'r', 0, 'g', 'm', ['人文', '生物']],
  ['Williams College', 'Williamstown', 'MA', 2, 90, 7, 'r', 0, 'g', 'n', ['人文', '经济', '艺术史']],
  ['Worcester Polytechnic Institute', 'Worcester', 'MA', 5, 86, 13, 'u', 0, 'i', 'm', ['工程', '计算机', '机器人']],
  ['Yale University', 'New Haven', 'CT', 6, 92, 6, 'u', 1, 'g', 'n', ['人文', '经济', '戏剧']],
  ['Yeshiva University', 'New York', 'NY', 3, 72, 7, 'u', 1, 'b', 'm', ['商科', '犹太研究', '医预']],
]

export const SCHOOL_FIT: Record<string, SchoolFit> = Object.fromEntries(
  ROWS.map(([name, city, state, undergrad, cost, ratio, setting, coastal, outcome, merit, programs]) => [
    name,
    {
      city,
      state,
      region: REGION_BY_STATE[state] ?? 'midwest',
      coastal: coastal === 1,
      setting: SETTINGS[setting],
      undergrad,
      studentFacultyRatio: ratio,
      costPerYear: cost,
      outcome: OUTCOMES[outcome],
      meritAid: MERIT[merit],
      strongPrograms: programs,
    },
  ]),
)

export function fitFor(schoolName: string): SchoolFit | undefined {
  return SCHOOL_FIT[schoolName]
}

/**
 * Class-size feel, which is what a student is really asking about when they
 * ask between a big lecture school and a small one. Enrolment matters more
 * than the ratio here: a 17:1 ratio at a 40,000-student university still means
 * a 300-person first-year lecture.
 */
export function classSizeFeel(fit: SchoolFit): 'small-seminar' | 'mid-size' | 'large-lecture' {
  if (fit.undergrad <= 4 || fit.studentFacultyRatio <= 10) return 'small-seminar'
  if (fit.undergrad <= 15) return 'mid-size'
  return 'large-lecture'
}
