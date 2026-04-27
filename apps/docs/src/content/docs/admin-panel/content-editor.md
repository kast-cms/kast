---
title: Content Editor
description: Create, edit, publish, and manage content entries in the admin panel.
---

The content editor is where `EDITOR+` users write and manage entries for a content type.

## Entry list

Click a content type in the sidebar to see its entry list. Each row shows:

- Entry title (first `short_text` field)
- Status badge (DRAFT / PUBLISHED / SCHEDULED / ARCHIVED)
- Last updated and by whom
- Quick-action buttons (edit, publish, trash)

Filter by status using the tabs at the top. Search by title with the search input.

## Creating an entry

1. Click **New Entry**.
2. Fill in the fields defined by the content type schema.
3. Click **Save Draft** to save without publishing, or **Publish** to make it live.

## Rich text editor

Rich text fields use a ProseMirror-based editor with:

- Headings (H1–H4), bold, italic, underline, strikethrough
- Bullet and numbered lists
- Blockquotes and code blocks
- Image insertion (picks from the media library)
- Internal links (to other content entries)
- Undo / redo

Content is stored as a ProseMirror JSON document and rendered to HTML by your frontend.

## Locale switcher

If the content type has localized fields, a locale switcher appears in the toolbar. Switch between locales to enter translations. Non-localized fields (like `slug`) show only once.

## Scheduling a publish

1. Click the dropdown arrow next to **Publish**.
2. Select **Schedule**.
3. Pick a date and time.
4. Click **Schedule**.

The status changes to `SCHEDULED` and the sidebar shows the countdown.

## Version history

Click the **History** tab (clock icon) in the right panel:

- Browse snapshots with timestamps and authors.
- Click **Preview** to see the content at that version.
- Click **Restore this version** to revert.

## SEO panel

Click the **SEO** tab in the right panel to set:

- Meta title and description
- Canonical URL
- OG title, description, and image
- `noIndex` toggle

The SEO score gauge updates as you fill fields.

## Related entries

If the content type has `relation` fields, a picker appears to search and select related entries by title.

## Saving and publishing

| Action     | Keyboard         | Behaviour                                    |
| ---------- | ---------------- | -------------------------------------------- |
| Save Draft | `Cmd/Ctrl+S`     | Saves without changing status                |
| Publish    | `Cmd/Ctrl+Enter` | Saves and sets status to PUBLISHED           |
| Unpublish  | —                | Sets status to ARCHIVED                      |
| Trash      | —                | Moves entry to trash (confirmation required) |
