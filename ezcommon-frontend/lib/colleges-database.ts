export interface CollegeDbEntry {
  id: string
  name: string
  code: string
  /** Approximate overall undergraduate acceptance rate (0-100). Illustrative
   * figures from general knowledge of recent admissions cycles, not a live
   * or certified data feed - good enough to anchor a demo forecast, not to
   * cite as an official statistic. */
  acceptanceRate: number
}

// A representative sample of real, well-known U.S. colleges and universities
// for the school-search demo. Institution names are public facts, not
// creative content. Codes here are stable placeholder IDs generated for this
// demo (not real CEEB/Common App codes) - swap in a real institution
// directory when this ships for real.
const NAMES_WITH_RATES: [string, number][] = [
  ['Amherst College', 7], ['Arizona State University', 88], ['Auburn University', 44],
  ['Baylor University', 45], ['Berea College', 32], ['Boston College', 19],
  ['Boston University', 14], ['Bowdoin College', 9], ['Brandeis University', 35],
  ['Brown University', 5], ['Bryn Mawr College', 30], ['Bucknell University', 28],
  ['California Institute of Technology', 3], ['Carleton College', 14], ['Carnegie Mellon University', 11],
  ['Case Western Reserve University', 30], ['Claremont McKenna College', 9], ['Clemson University', 40],
  ['Colby College', 8], ['Colgate University', 10], ['College of William & Mary', 33],
  ['Colorado College', 12], ['Columbia University', 4], ['Cornell University', 8],
  ['Dartmouth College', 6], ['Davidson College', 15], ['Denison University', 30],
  ['DePaul University', 68], ['Drexel University', 75], ['Duke University', 6],
  ['Emory University', 11], ['Florida State University', 25], ['Fordham University', 45],
  ['George Washington University', 44], ['Georgetown University', 12], ['Georgia Institute of Technology', 15],
  ['Gettysburg College', 44], ['Grinnell College', 9], ['Hamilton College', 11],
  ['Harvard University', 3], ['Harvey Mudd College', 10], ['Haverford College', 14],
  ['Indiana University Bloomington', 80], ['Johns Hopkins University', 7], ['Kenyon College', 30],
  ['Lafayette College', 24], ['Lehigh University', 32], ['Macalester College', 26],
  ['Massachusetts Institute of Technology', 4], ['Miami University', 85], ['Michigan State University', 85],
  ['Middlebury College', 13], ['New York University', 9], ['North Carolina State University', 45],
  ['Northeastern University', 7], ['Northwestern University', 7], ['Oberlin College', 30],
  ['Occidental College', 35], ['Ohio State University', 53], ['Pennsylvania State University', 50],
  ['Pepperdine University', 33], ['Pitzer College', 15], ['Pomona College', 6],
  ['Princeton University', 4], ['Purdue University', 53], ['Rice University', 9],
  ['Rutgers University', 62], ['Santa Clara University', 50], ['Scripps College', 30],
  ['Smith College', 30], ['Southern Methodist University', 48], ['Stanford University', 4],
  ['Swarthmore College', 7], ['Syracuse University', 55], ['Texas A&M University', 63],
  ['Trinity College', 30], ['Tufts University', 9], ['Tulane University', 11],
  ['Union College', 35], ['University of California, Berkeley', 11], ['University of California, Davis', 37],
  ['University of California, Irvine', 21], ['University of California, Los Angeles', 9], ['University of California, San Diego', 24],
  ['University of California, Santa Barbara', 26], ['University of Chicago', 5], ['University of Colorado Boulder', 78],
  ['University of Connecticut', 55], ['University of Florida', 23], ['University of Georgia', 40],
  ['University of Illinois Urbana-Champaign', 44], ['University of Maryland, College Park', 44], ['University of Massachusetts Amherst', 57],
  ['University of Miami', 19], ['University of Michigan', 18], ['University of Minnesota Twin Cities', 70],
  ['University of North Carolina at Chapel Hill', 17], ['University of Notre Dame', 13], ['University of Pennsylvania', 6],
  ['University of Pittsburgh', 50], ['University of Richmond', 26], ['University of Rochester', 40],
  ['University of Southern California', 10], ['University of Texas at Austin', 29], ['University of Virginia', 19],
  ['University of Washington', 44], ['University of Wisconsin-Madison', 43], ['Vanderbilt University', 5],
  ['Vassar College', 19], ['Villanova University', 24], ['Wake Forest University', 22],
  ['Washington and Lee University', 15], ['Washington University in St. Louis', 11], ['Wellesley College', 13],
  ['Wesleyan University', 14], ['Wheaton College', 78], ['Whitman College', 50],
  ['Williams College', 8], ['Yale University', 4],
]

function codeFor(name: string, index: number): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return String(1000 + ((hash + index * 7) % 9000)).padStart(4, '0')
}

export const COLLEGES_DATABASE: CollegeDbEntry[] = [...NAMES_WITH_RATES]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([name, acceptanceRate], i) => ({
    id: `college-${i}`,
    name,
    code: codeFor(name, i),
    acceptanceRate,
  }))
