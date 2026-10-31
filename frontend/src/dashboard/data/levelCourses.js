import { STUDENT_COURSES } from "./courses";

/**
 * Level-specific AgriLearn courses (100 / 200 / 300).
 * 500 Level courses stay in ./courses.js and are returned unchanged.
 * Each course includes an image matched to its subject title.
 */

export const LEVEL_100_COURSES = [
  {
    code: "CHM101",
    title: "General Physical Chemistry",
    image:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Chemistry laboratory glassware for physical chemistry",
  },
  {
    code: "CHM115",
    title: "General Practical Chemistry I",
    image:
      "https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Practical chemistry work in a science laboratory",
  },
  {
    code: "CSC111",
    title: "Introduction to Computer Science I",
    image:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Laptop with computer programming code on screen",
  },
  {
    code: "GEM105",
    title: "Earth History",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Mountain landscape representing earth history and geology",
  },
  {
    code: "GNS111",
    title: "Use of English I",
    image:
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Open books for English language learning",
  },
  {
    code: "MAT115",
    title: "Mathematics for Agriculture and Biosciences I",
    image:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Mathematics equations for agriculture and biosciences",
  },
  {
    code: "PHY115",
    title: "Mechanics and Properties of Matter I",
    image:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Physics and engineering laboratory for mechanics",
  },
  {
    code: "PLB101",
    title: "Cell Biology",
    image:
      "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Microscope used in cell biology",
  },
  {
    code: "ZLY101",
    title: "Introductory Ecology",
    image:
      "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Forest ecosystem for introductory ecology",
  },
  {
    code: "ZLY103",
    title: "Introductory Animal Diversity",
    image:
      "https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Wildlife representing animal diversity",
  },
];

export const LEVEL_200_COURSES = [
  {
    code: "ABE205",
    title: "Farm Power and Machinery for Agricultural Students",
    image:
      "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Tractor representing farm power and machinery",
  },
  {
    code: "AEF201",
    title: "Introduction to Microeconomics",
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Market charts for introduction to microeconomics",
  },
  {
    code: "AFS201",
    title: "Introduction to Food Science and Technology",
    image:
      "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Food preparation for food science and technology",
  },
  {
    code: "AGY201",
    title: "Principles of Agricultural Climatology",
    image:
      "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Weather sky over landscape for agricultural climatology",
  },
  {
    code: "AGY203",
    title: "Agricultural Botany",
    image:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Green plants for agricultural botany",
  },
  {
    code: "AGY205",
    title: "Introduction to Soil Science",
    image:
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Hands studying soil for soil science",
  },
  {
    code: "AHE201",
    title: "Introduction to Home Economics",
    image:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Home kitchen for home economics",
  },
  {
    code: "ANP205",
    title: "Fundamentals of Nutrition",
    image:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Healthy foods for fundamentals of nutrition",
  },
  {
    code: "ANP207",
    title: "Introduction to Animal Science",
    image:
      "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Farm poultry for introduction to animal science",
  },
  {
    code: "AXR201",
    title: "Introduction to General Sociology",
    image:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
    imageAlt: "People together for general sociology",
  },
  {
    code: "CPT201",
    title: "Introduction to the Study of Arthropods",
    image:
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Insect close-up for the study of arthropods",
  },
  {
    code: "GNS211",
    title: "Philosophy, Logic and Nigerian Culture",
    image:
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Library shelves for philosophy, logic and culture",
  },
];

export const LEVEL_300_COURSES = [
  {
    code: "AEF301",
    title: "Principles of Microeconomics",
    image:
      "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Finance imagery for principles of microeconomics",
  },
  {
    code: "AGY303",
    title: "Introductory Weed Science",
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Field plants and weeds for weed science",
  },
  {
    code: "AGY307",
    title: "Elements of Soil Chemistry and Fertility",
    image:
      "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Crop field representing soil fertility",
  },
  {
    code: "AGY309",
    title: "Agronomy of Permanent Crops",
    image:
      "https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Orchard trees for agronomy of permanent crops",
  },
  {
    code: "ANP301",
    title: "Anatomy and Physiology of Farm Animals",
    image:
      "https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Farm animal for anatomy and physiology",
  },
  {
    code: "ANP309",
    title: "Introduction to Animal Breeding",
    image:
      "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Cattle for introduction to animal breeding",
  },
  {
    code: "AXR301",
    title: "Introduction to Agricultural Extension",
    image:
      "https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Farm field work for agricultural extension",
  },
  {
    code: "CPT301",
    title: "Economic Entomology",
    image:
      "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Butterfly and insects for economic entomology",
  },
  {
    code: "GNS311",
    title: "History and Philosophy of Science",
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Earth from space representing history of science",
  },
  {
    code: "GSE301",
    title: "Graduate Self Employment",
    image:
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Business handshake for graduate self employment",
  },
];

const RAW_BY_LEVEL = {
  "100": LEVEL_100_COURSES,
  "200": LEVEL_200_COURSES,
  "300": LEVEL_300_COURSES,
};

function enrichLevelCourse(course, level) {
  return {
    code: course.code,
    title: course.title,
    levelLabel: `${level} Level`,
    image: course.image,
    imageAlt: course.imageAlt || `${course.code} — ${course.title}`,
    topicsCompleted: 0,
    topicsTotal: 0,
  };
}

export function getCoursesForLevel(level) {
  const key = String(level || "");
  if (key === "500") return STUDENT_COURSES;
  const raw = RAW_BY_LEVEL[key] || [];
  return raw.map((course) => enrichLevelCourse(course, key));
}

export function getLevelCourseByCode(level, code) {
  const needle = String(code || "").toLowerCase();
  return getCoursesForLevel(level).find(
    (course) => course.code.toLowerCase() === needle
  );
}
