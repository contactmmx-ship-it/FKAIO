import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhone,
  validateRequired,
  validateLeadForm,
} from '../../utils/validation';

describe('validateEmail', () => {
  it('returns true for empty string (optional field)', () => {
    expect(validateEmail('')).toBe(true);
  });

  it('returns true for valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test@franchiseekart.com')).toBe(true);
    expect(validateEmail('admin@fk.aios.in')).toBe(true);
  });

  it('returns true for emails with subdomains', () => {
    expect(validateEmail('user@mail.franchiseekart.com')).toBe(true);
  });

  it('returns false for email without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('returns false for email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('returns false for email without TLD', () => {
    expect(validateEmail('user@domain')).toBe(false);
  });

  it('returns false for email with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });

  it('returns false for double @', () => {
    expect(validateEmail('user@@example.com')).toBe(false);
  });
});

describe('validatePhone', () => {
  it('returns true for empty string (optional field)', () => {
    expect(validatePhone('')).toBe(true);
  });

  it('returns true for valid 10-digit Indian mobile', () => {
    expect(validatePhone('9876543210')).toBe(true);
    expect(validatePhone('8765432109')).toBe(true);
  });

  it('returns true for Indian mobile with +91 prefix', () => {
    expect(validatePhone('+919876543210')).toBe(true);
  });

  it('returns true for Indian mobile with 91 prefix', () => {
    expect(validatePhone('919876543210')).toBe(true);
  });

  it('returns true for Indian mobile with leading 0', () => {
    expect(validatePhone('09876543210')).toBe(true);
  });

  it('returns true for formatted numbers', () => {
    expect(validatePhone('+91 98765 43210')).toBe(true);
    expect(validatePhone('98765-43210')).toBe(true);
    expect(validatePhone('+91 (987) 654-3210')).toBe(true);
  });

  it('returns false for numbers starting with 0-5', () => {
    expect(validatePhone('1234567890')).toBe(false);
    expect(validatePhone('5678901234')).toBe(false);
  });

  it('returns false for 9-digit number', () => {
    expect(validatePhone('987654321')).toBe(false);
  });

  it('returns false for 11-digit number without prefix', () => {
    expect(validatePhone('98765432101')).toBe(false);
  });

  it('returns false for non-numeric', () => {
    expect(validatePhone('abcdefghijk')).toBe(false);
  });
});

describe('validateRequired', () => {
  it('returns null for non-empty string', () => {
    expect(validateRequired('hello', 'Field')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateRequired('', 'Name')).toBe('Name is required');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateRequired('   ', 'Name')).toBe('Name is required');
  });

  it('includes field name in error message', () => {
    expect(validateRequired('', 'Email')).toBe('Email is required');
    expect(validateRequired('', 'Phone Number')).toBe('Phone Number is required');
  });
});

describe('validateLeadForm', () => {
  it('returns no errors for valid form', () => {
    const errors = validateLeadForm({
      name: 'Raj Sharma',
      mobile: '+919876543210',
      email: 'raj@example.com',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns name error when name is missing', () => {
    const errors = validateLeadForm({ name: '', mobile: '9876543210' });
    expect(errors.name).toBe('Name is required');
  });

  it('returns mobile error for invalid phone', () => {
    const errors = validateLeadForm({ name: 'Test', mobile: '12345' });
    expect(errors.mobile).toBe('Enter a valid Indian mobile number (10 digits)');
  });

  it('returns email error for invalid email', () => {
    const errors = validateLeadForm({ name: 'Test', email: 'not-an-email' });
    expect(errors.email).toBe('Enter a valid email address');
  });

  it('does not require mobile if not provided', () => {
    const errors = validateLeadForm({ name: 'Test User' });
    expect(errors.mobile).toBeUndefined();
  });

  it('does not require email if not provided', () => {
    const errors = validateLeadForm({ name: 'Test User' });
    expect(errors.email).toBeUndefined();
  });

  it('returns multiple errors for form with multiple issues', () => {
    const errors = validateLeadForm({
      name: '',
      mobile: 'abc',
      email: 'bad-email',
    });
    expect(errors.name).toBeDefined();
    expect(errors.mobile).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it('handles undefined form values gracefully', () => {
    const errors = validateLeadForm({});
    expect(errors.name).toBe('Name is required');
    expect(errors.mobile).toBeUndefined();
    expect(errors.email).toBeUndefined();
  });
});
