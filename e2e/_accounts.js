// Shared by the e2e suites and the release-audit scripts (scripts/audit/_lib.js).

/**
 * Mark a throwaway account's email verified, as following the emailed link would.
 * An unverified account can't invite anyone, and locally no email is sent, so a
 * suite that invites calls this for the inviter first.
 */
async function markVerified(prisma, email) {
  await prisma.user.update({ where: { email: email.trim().toLowerCase() }, data: { emailVerified: true } });
}

module.exports = { markVerified };
