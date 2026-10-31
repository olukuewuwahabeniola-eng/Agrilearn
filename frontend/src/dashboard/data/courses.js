/**
 * The six AgriLearn courses for this student platform.
 * Titles and imagery are matched to each course topic.
 */
export const STUDENT_COURSES = [
  {
    code: "STA433",
    title: "Statistical Methods & Field Experimentation",
    levelLabel: "500 Level",
    image:
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=900&q=80",
    imageAlt:
      "Agricultural research field plots used for field experimentation",
    topicsCompleted: 0,
    topicsTotal: 0,
  },
  {
    code: "AEF515",
    title: "Economics of Cooperatives",
    levelLabel: "500 Level",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
    imageAlt:
      "Fresh produce at a cooperative-style agricultural market",
    topicsCompleted: 0,
    topicsTotal: 0,
  },
  {
    code: "AEF517",
    title: "Farm Management Analysis and Accounting",
    levelLabel: "500 Level",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Farm management accounting with financial records and analysis",
    topicsCompleted: 0,
    topicsTotal: 0,
  },
  {
    code: "AEF519",
    title: "Agricultural Project Planning and Implementation",
    levelLabel: "500 Level",
    image:
      "https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Irrigation and farm development project in the field",
    topicsCompleted: 0,
    topicsTotal: 0,
  },
  {
    code: "ANP513",
    title: "Poultry Production",
    levelLabel: "500 Level",
    image:
      "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Healthy chickens in a poultry production setting",
    topicsCompleted: 0,
    topicsTotal: 0,
  },
  {
    code: "ANP517",
    title: "Ruminant Animal Production",
    levelLabel: "500 Level",
    image:
      "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Cow on a ruminant livestock farm",
    topicsCompleted: 0,
    topicsTotal: 0,
  },
];

export function getCourseByCode(code) {
  return STUDENT_COURSES.find(
    (course) => course.code.toLowerCase() === String(code).toLowerCase()
  );
}

export function getInitials(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getFirstName(fullName = "") {
  return fullName.trim().split(/\s+/)[0] || "Student";
}
