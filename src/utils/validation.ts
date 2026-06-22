export function validateEmail(email: string): boolean {
  if (!email) return true; // email is optional unless required elsewhere
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone: string): boolean {
  if (!phone) return true; // phone is optional unless required elsewhere
  // Indian phone format: 10 digits, optionally with +91 prefix or leading 0
  const cleaned = phone.replace(/[\s\-+()]/g, '');
  const indianPhoneRe = /^(\+91|91|0)?[6-9]\d{9}$/;
  return indianPhoneRe.test(cleaned);
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || !value.trim()) {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateLeadForm(form: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};

  // Name is required
  const nameError = validateRequired(form.name || '', 'Name');
  if (nameError) errors.name = nameError;

  // Mobile validation (Indian format) if provided
  if (form.mobile && form.mobile.trim()) {
    if (!validatePhone(form.mobile)) {
      errors.mobile = 'Enter a valid Indian mobile number (10 digits)';
    }
  }

  // Email validation if provided
  if (form.email && form.email.trim()) {
    if (!validateEmail(form.email)) {
      errors.email = 'Enter a valid email address';
    }
  }

  return errors;
}