/**
 * Course catalogs used to validate AI requests by academic level.
 * Keep aligned with frontend dashboard course lists.
 */

const LEVEL_100 = [
  { code: "CHM101", title: "General Physical Chemistry" },
  { code: "CHM115", title: "General Practical Chemistry I" },
  { code: "CSC111", title: "Introduction to Computer Science I" },
  { code: "GEM105", title: "Earth History" },
  { code: "GNS111", title: "Use of English I" },
  { code: "MAT115", title: "Mathematics for Agriculture and Biosciences I" },
  { code: "PHY115", title: "Mechanics and Properties of Matter I" },
  { code: "PLB101", title: "Cell Biology" },
  { code: "ZLY101", title: "Introductory Ecology" },
  { code: "ZLY103", title: "Introductory Animal Diversity" },
];

const LEVEL_200 = [
  { code: "ABE205", title: "Farm Power and Machinery for Agricultural Students" },
  { code: "AEF201", title: "Introduction to Microeconomics" },
  { code: "AFS201", title: "Introduction to Food Science and Technology" },
  { code: "AGY201", title: "Principles of Agricultural Climatology" },
  { code: "AGY203", title: "Agricultural Botany" },
  { code: "AGY205", title: "Introduction to Soil Science" },
  { code: "AHE201", title: "Introduction to Home Economics" },
  { code: "ANP205", title: "Fundamentals of Nutrition" },
  { code: "ANP207", title: "Introduction to Animal Science" },
  { code: "AXR201", title: "Introduction to General Sociology" },
  { code: "CPT201", title: "Introduction to the Study of Arthropods" },
  { code: "GNS211", title: "Philosophy, Logic and Nigerian Culture" },
];

const LEVEL_300 = [
  { code: "AEF301", title: "Principles of Microeconomics" },
  { code: "AGY303", title: "Introductory Weed Science" },
  { code: "AGY307", title: "Elements of Soil Chemistry and Fertility" },
  { code: "AGY309", title: "Agronomy of Permanent Crops" },
  { code: "ANP301", title: "Anatomy and Physiology of Farm Animals" },
  { code: "ANP309", title: "Introduction to Animal Breeding" },
  { code: "AXR301", title: "Introduction to Agricultural Extension" },
  { code: "CPT301", title: "Economic Entomology" },
  { code: "GNS311", title: "History and Philosophy of Science" },
  { code: "GSE301", title: "Graduate Self Employment" },
];

const LEVEL_500 = [
  { code: "STA433", title: "Statistical Methods & Field Experimentation" },
  { code: "AEF515", title: "Economics of Cooperatives" },
  { code: "AEF517", title: "Farm Management Analysis and Accounting" },
  { code: "AEF519", title: "Agricultural Project Planning and Implementation" },
  { code: "ANP513", title: "Poultry Production" },
  { code: "ANP517", title: "Ruminant Animal Production" },
];

const BY_LEVEL = {
  "100": LEVEL_100,
  "200": LEVEL_200,
  "300": LEVEL_300,
  "500": LEVEL_500,
};

function getCoursesForLevel(level) {
  return BY_LEVEL[String(level)] || [];
}

function findCourseForStudent(level, courseCode) {
  if (!courseCode) return null;
  const needle = String(courseCode).trim().toLowerCase();
  return (
    getCoursesForLevel(level).find(
      (course) => course.code.toLowerCase() === needle
    ) || null
  );
}

module.exports = {
  getCoursesForLevel,
  findCourseForStudent,
};
