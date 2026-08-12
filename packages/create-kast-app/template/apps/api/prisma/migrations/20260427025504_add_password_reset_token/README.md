# Immutable initial baseline

Despite its historical directory name, `migration.sql` is the initial Kast
database baseline: it creates the complete schema that existed on 2026-04-27,
including (but not limited to) password reset tokens.

Do not rename or split this directory. Prisma records the directory name in
`_prisma_migrations`; changing an already-released name makes existing installs
look divergent and makes a new install attempt the baseline twice. New schema
changes must be placed in a new, narrowly named migration directory.
