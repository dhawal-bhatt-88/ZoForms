// The clinic's client IDs: DEMO- and six digits.
const CLIENT_ID = /^DEMO-\d{6}$/;

export const validators = [
  {
    field: 'client_id',
    validate: ({ value }) =>
      typeof value === 'string' && !CLIENT_ID.test(value.trim())
        ? 'Enter the client ID as DEMO- and six digits, such as DEMO-123456.'
        : null,
  },
  {
    field: 'first_session',
    // answers holds the questions that are answered and pass their own checks.
    validate: ({ value, answers }) =>
      typeof value === 'string' && typeof answers.referral_date === 'string' && value < answers.referral_date
        ? "The first session can't be before the referral date."
        : null,
  },
];
