export const LOGIN_SELECTION_PATH = "/signin";
export const STUDENT_LOGIN_PATH = "/login";
export const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * Return to the page visited immediately before the login selection screen.
 * Direct visits (no in-app history) go to the AgriLearn homepage.
 */
export function goBackFromLoginSelection(navigate, location) {
  if (location.key !== "default") {
    navigate(-1);
    return;
  }
  navigate("/", { replace: true });
}
