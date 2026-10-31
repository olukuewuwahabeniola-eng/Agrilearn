import { useSearchParams } from "react-router-dom";
import CourseCard from "../components/CourseCard";
import PageHeader from "../components/PageHeader";
import { useLevelCourses } from "../hooks/useLevelCourses";

function Courses() {
  const [params] = useSearchParams();
  const { level, courses: levelCourses } = useLevelCourses();
  const q = (params.get("q") || "").trim().toLowerCase();

  const courses = levelCourses.filter((course) => {
    if (!q) return true;
    return (
      course.code.toLowerCase().includes(q) ||
      course.title.toLowerCase().includes(q)
    );
  });

  return (
    <section className="page-card page-hero">
      <PageHeader
        title="My Courses"
        subtitle={`Your ${level} Level AgriLearn courses for this session.`}
      />

      {courses.length === 0 ? (
        <div className="empty-state">
          <strong>No matching courses</strong>
          Try another search term.
        </div>
      ) : (
        <div className="courses-grid">
          {courses.map((course, index) => (
            <CourseCard
              key={course.code}
              course={course}
              style={{ animationDelay: `${0.05 * index}s` }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default Courses;
