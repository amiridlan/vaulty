# Extra Fields — Sprint Plan

Adds user-defined key-value fields to any password entry. Covers backup codes, secret words, PINs, recovery phrases, API keys, or any other credential a site may use beyond the standard site/username/email/password set.

---

## Design

### Data model

A single new column `encrypted_extra_fields TEXT` on `password_entries`. The value is the AES-256 encryption of a JSON array:

```json
[
  { "label": "Secret word",  "value": "opensesame" },
  { "label": "Recovery key", "value": "XXXX-XXXX-XXXX-XXXX" },
  { "label": "PIN",          "value": "9271" }
]
```

**Why a JSON blob rather than a separate table:**
All field values are sensitive and encrypted as a unit — there's no server-side querying benefit to normalising them. A single column keeps the schema, queries, sync protocol, and encryption surface minimal.

**Encryption:** the entire JSON array is encrypted as one string with `EncryptionService.encrypt()` — identical to how `encrypted_site`, `encrypted_password`, etc. work today. NULL in the column means no extra fields.

### In-memory representation

```typescript
export interface ExtraField {
  label: string;   // user-defined label, e.g. "Secret word"
  value: string;   // plaintext in memory, encrypted at rest
}
```

`DecryptedPasswordEntry` grows an `extra_fields: ExtraField[]` property (empty array when NULL).

### Sync

`encrypted_extra_fields` is just another encrypted column on `password_entries`. The sync protocol's INSERT and UPDATE statements in `syncProtocol.ts` already carry the full row — they just need this column added to their column lists. No merge logic changes required.

---

## UI overview

**Entry card (`PasswordEntry.vue`) — view mode**

```
┌─ amazon.com ──────────────────────────────────── [👁] [✏] [📋] [🗑] ─┐
│  Username:  ••••••••                                                   │
│  Email:     ••••••••                                                   │
│  Password:  ••••••••                                                   │
│  ─────────────────────────────────────────────────────────────────    │
│  Secret word:    ••••••••  [👁] [📋]                                  │
│  Recovery key:   ••••••••  [👁] [📋]                                  │
└──────────────────────────────────────────────────────────────────────┘
```

Each extra field value is masked individually. Reveal and copy buttons per field.

**Entry form (`PasswordList.vue`) — add / edit mode**

```
  Site, Username, Email, Password  (existing fields)

  ── Extra fields ────────────────────────────
  [ Secret word      ] [ ••••••••  ] [👁] [✕]
  [ Recovery key     ] [ ••••••••  ] [👁] [✕]
  [ + Add field      ]
    ↓ (dropdown of suggestions when clicked)
    Secret word  |  Recovery key  |  Backup code
    PIN          |  API key       |  Custom…
```

Label is freeform text; the suggestion dropdown is purely a convenience shortcut.

---

## Post-Sprint Checklist

- [ ] `npx vue-tsc --noEmit` passes
- [ ] `cargo check` passes (no Rust changes expected)
- [ ] Update CLAUDE.md

---

## Sprint EF1 — Data Layer

**Goal:** Extra fields persist, encrypt, decrypt, and sync correctly. No UI changes yet.

**`src/services/database.ts`**
- [ ] Add idempotent migration:
  ```sql
  ALTER TABLE password_entries ADD COLUMN encrypted_extra_fields TEXT
  ```
  (wrap in try/catch like the existing `sync_id` migrations)

**`src/types/index.ts`**
- [ ] Add `ExtraField` interface
- [ ] Add `encrypted_extra_fields: string | null` to `PasswordEntry`
- [ ] Add `extra_fields: ExtraField[]` to `DecryptedPasswordEntry`

**`src/stores/passwordOwners.ts`**
- [ ] `loadPasswordEntries` — decrypt `encrypted_extra_fields` when not null; fall back to `[]` for null/legacy rows. Decrypted entries already carry all fields; just extend the destructuring.
- [ ] `createPasswordEntry(ownerId, site, username, email, password, extraFields: ExtraField[] = [])` — encrypt extra fields JSON, include in INSERT
- [ ] `updatePasswordEntry(entryId, site, username, email, password, extraFields: ExtraField[] = [])` — encrypt extra fields JSON, include in UPDATE

**`src/services/syncProtocol.ts`**
- [ ] `buildSyncPayload` — `encrypted_extra_fields` is already included by `SELECT *`, no change needed
- [ ] `mergeSyncPayload` INSERT — add `encrypted_extra_fields` to the column list and values
- [ ] `mergeSyncPayload` UPDATE — add `encrypted_extra_fields = ?` to the SET clause

**Post-Sprint EF1:**
- [ ] TS check passes
- [ ] Verify existing entries load without error (extra_fields defaults to [])

---

## Sprint EF2 — UI

**Goal:** Users can add, view, reveal, copy, edit, and delete extra fields on any password entry.

**`src/components/PasswordList.vue`** (the add/edit form)
- [ ] Extend `formData` with `extraFields: ExtraField[]`
- [ ] When loading an entry for edit, populate `formData.extraFields` from the decrypted entry
- [ ] When submitting, pass `formData.extraFields` to `createPasswordEntry` / `updatePasswordEntry`
- [ ] Add the extra fields section at the bottom of the form:
  - List of `{ label, value }` rows — each with a label text input, masked value input, toggle visibility button, and remove (✕) button
  - "Add field" button that opens a small suggestion dropdown (predefined labels + "Custom") and appends a new empty row

**Suggestion labels (shown in dropdown):**
`Secret word`, `Recovery key`, `Backup code`, `PIN`, `API key`, `Security phrase`, `Note`
Selecting any opens an empty row pre-filled with that label. "Custom" opens a blank row.

**`src/components/PasswordEntry.vue`** (the entry card)
- [ ] After the existing password row, render extra fields when `entry.extra_fields.length > 0`
- [ ] Each row: label + masked value (`••••••••`) + per-field reveal toggle (Eye/EyeOff) + copy button
- [ ] Revealing an extra field is independent of the main "show details" toggle — each field has its own visibility state
- [ ] Copy button copies the plaintext value with the same clipboard flash feedback as the existing copy-password button

---

## Sprint Status

| Sprint | Title | Status |
|--------|-------|--------|
| EF1 | Data Layer | ⬜ Not started |
| EF2 | UI | ⬜ Not started |

---

## Files touched

```
src/types/index.ts                  (ExtraField interface, updated PasswordEntry + DecryptedPasswordEntry)
src/services/database.ts            (ALTER TABLE migration)
src/stores/passwordOwners.ts        (encrypt/decrypt extra fields, update create/update signatures)
src/services/syncProtocol.ts        (add column to INSERT + UPDATE merge statements)
src/components/PasswordList.vue     (extra fields in add/edit form)
src/components/PasswordEntry.vue    (extra fields in entry card view)
```

No Rust changes. No new files.
