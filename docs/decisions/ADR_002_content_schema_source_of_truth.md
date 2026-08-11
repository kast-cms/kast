# ADR 002 — Where content schemas live

Date: August 2026
Status: **Open — needs a decision**

## Context

The vision document said "schemas live in TypeScript files, not only in a database". The implementation does the
opposite: `ContentType` and `ContentField` are Prisma models, and the admin's content-type builder writes them at
runtime. Nothing about a content model is in version control.

That is not a bug — a database-defined model is what makes the builder possible, and it is what Strapi and
Directus do. But the two statements cannot both stand, and the gap has consequences that are already visible:

- A model change is an untracked production write. There is no diff, no review, no author, no revert.
- Promoting a model from staging to production has no mechanism. Someone repeats the clicks.
- `packages/sdk` cannot generate types for content that only exists in a database it has never seen, so entry data
  is typed as `Record<string, unknown>` at the edge of an otherwise type-safe stack.
- Runtime validation (added in the P0 remediation) compiles its rules from those database rows, so the rules
  change without a deployment.

## Options

**A. Database-defined (ratify what exists).** Keep the builder as the only way to define a model. Close the gap by
adding schema versioning, an export/import format for environment promotion, and an audited history of model
changes. Cheapest, keeps the admin's main selling point, but content models stay outside code review forever.

**B. Code-defined.** Content types are declared in TypeScript, checked in, and applied by a migration. The builder
becomes read-only, or a scaffolding tool that writes files. Gives review, diff, revert and generated types.
Expensive, and it removes the ability for a non-developer to add a field — which is much of the product's appeal.

**C. Hybrid, with one owner per model.** Models may be declared in code _or_ built in the admin, but each model
records which is authoritative. Code-owned models are read-only in the builder and applied on deploy; admin-owned
models keep today's behavior. Most flexible and probably where this lands, but it is also the most work and it
introduces drift-detection as a permanent obligation.

## What is not in question

Whichever is chosen, two things are needed and are worth doing before the decision:

- an export/import representation of a content model, since every option needs one;
- an audit record of who changed a model and when, since today none of the options can reconstruct it.

## Decision

Not made. This blocks nothing today, but it should be settled before the SDK promises typed content entries or
before anyone runs more than one environment, because both harden whichever answer is implicit at the time.
