const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(value.trim());
}

export function validateSignUp(values) {
  const errors = {};

  const fullName = values.fullName.trim();
  if (!fullName) {
    errors.fullName = "Please enter your full name.";
  } else if (fullName.length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  }

  const email = values.email.trim();
  if (!email) {
    errors.email = "Please enter your student email.";
  } else if (!isValidEmail(email)) {
    errors.email = "Please enter a valid email address.";
  }

  const matricNumber = values.matricNumber.trim();
  if (!matricNumber) {
    errors.matricNumber = "Please enter your matriculation number.";
  } else if (matricNumber.length < 4) {
    errors.matricNumber = "Matriculation number looks too short.";
  }

  if (!values.level) {
    errors.level = "Please select your academic level.";
  } else if (!["100", "200", "300", "500"].includes(values.level)) {
    errors.level = "Choose 100, 200, 300, or 500 level.";
  }

  if (!values.password) {
    errors.password = "Please create a password.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export function validateLogin(values) {
  const errors = {};

  const identifier = values.identifier.trim();
  if (!identifier) {
    errors.identifier = "Enter your student email or matriculation number.";
  }

  if (!values.password) {
    errors.password = "Please enter your password.";
  }

  return errors;
}
