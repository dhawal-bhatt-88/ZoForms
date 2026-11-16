-- Platform admins could once sign in to the builder as a client user. The feature is
-- removed, and so is every audit row it wrote: the sign-ins and the refused attempts.
DELETE FROM "AuditLog" WHERE "action" LIKE 'user.imperson%';
