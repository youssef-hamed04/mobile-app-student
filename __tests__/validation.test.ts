import {
  accessCodeSchema,
  fullNameSchema,
  loginSchema,
  normalizePhone,
  passwordSchema,
  passwordStrength,
  phoneSchema,
  registerAccountSchema,
} from '@/features/auth/schemas';

describe('phone', () => {
  it.each([
    ['01001234567', '01001234567'],
    ['+201001234567', '01001234567'],
    ['00201001234567', '01001234567'],
    ['0100 123 4567', '01001234567'],
    ['0100-123-4567', '01001234567'],
  ])('normalizes %s', (input, expected) => {
    expect(phoneSchema.parse(input)).toBe(expected);
    expect(normalizePhone(input.replace(/[\s-]/g, ''))).toBe(expected);
  });

  it.each(['0123456', '02001234567', 'abcdefghijk', '', '013012345678'])(
    'rejects %s',
    (input) => {
      expect(phoneSchema.safeParse(input).success).toBe(false);
    }
  );
});

describe('full name', () => {
  it('requires at least three parts', () => {
    expect(fullNameSchema.safeParse('Ahmed Mohamed').success).toBe(false);
    expect(fullNameSchema.safeParse('Ahmed Mohamed Ali').success).toBe(true);
    expect(fullNameSchema.safeParse('Ahmed Mohamed Ali Hassan').success).toBe(true);
  });

  it('accepts Arabic script', () => {
    expect(fullNameSchema.safeParse('أحمد محمد علي').success).toBe(true);
  });

  it('rejects digits and symbols', () => {
    expect(fullNameSchema.safeParse('Ahmed 123 Ali').success).toBe(false);
    expect(fullNameSchema.safeParse('Ahmed <script> Ali').success).toBe(false);
  });

  it('reports failures as i18n keys, never as prose', () => {
    const result = fullNameSchema.safeParse('Ahmed');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/^validation\./);
    }
  });
});

describe('password', () => {
  it('enforces length, case and a digit', () => {
    expect(passwordSchema.safeParse('short1A').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase1').success).toBe(false);
    expect(passwordSchema.safeParse('NoDigitsHere').success).toBe(false);
    expect(passwordSchema.safeParse('GoodPass1').success).toBe(true);
  });

  it('does NOT apply complexity rules at login', () => {
    // An existing account may predate the current policy; rejecting it
    // client-side would lock the student out of a password the server accepts.
    expect(
      loginSchema.safeParse({ phone: '01001234567', password: 'old' }).success
    ).toBe(true);
  });

  it('scores strength monotonically', () => {
    expect(passwordStrength('abc').level).toBe('weak');
    expect(passwordStrength('Abcdefg1').score).toBeGreaterThan(
      passwordStrength('abcdefg').score
    );
    expect(passwordStrength('Abcdefgh1!xyz').level).toBe('strong');
  });
});

describe('registration', () => {
  const valid = {
    fullName: 'Ahmed Mohamed Ali',
    phone: '01001234567',
    password: 'GoodPass1',
    confirmPassword: 'GoodPass1',
  };

  it('accepts a well-formed account step', () => {
    expect(registerAccountSchema.safeParse(valid).success).toBe(true);
  });

  it('reports a mismatch on the confirm field, not the password field', () => {
    const result = registerAccountSchema.safeParse({
      ...valid,
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });
});

describe('access code', () => {
  it('trims and upper-cases', () => {
    expect(accessCodeSchema.parse({ code: '  dsa1-2026-abcd ' }).code).toBe(
      'DSA1-2026-ABCD'
    );
  });
});
