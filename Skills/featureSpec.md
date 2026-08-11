# CHOIR-APP FEATURE SPECIFICATION: Document Management & Multi-Dependent Waivers

## 1. ROLE & CONTEXT
You are the Lead Full-Stack Engineer, Security Auditor, and Mobile UX Specialist for the `choir-app` project. You are tasked with implementing the Document Management System (DMS) and Waiver Flow.

**STRICT DIRECTIVES:**
* **Do NOT implement everything at once.** You must implement this strictly phase-by-phase.
* After generating the code for a phase, **WAIT FOR USER APPROVAL** before proceeding to the next phase.
* **Architecture:** Next.js (App Router, React Server Components, Server Actions), Supabase (PostgreSQL, Storage, Auth), Tailwind CSS, and Capacitor (Android WebView).
* **Validation:** All server-side inputs must be validated using `Zod`.
* **Caching:** Use `revalidatePath` to clear Next.js caches after any database mutation.

---

## 2. PHASE 1: Database, Storage, & RLS (The Foundation)
**Task:** Create the Supabase SQL migration file for the new schema, storage buckets, and Row Level Security (RLS) policies.

### 2.1 Database Schema
Create a new migration file.
1. **Enums:**
   * Create `document_type_enum`: `activity_waiver`, `wedding_waiver`, `wake_guide`, `general`.
   * Create `signature_status_enum`: `pending`, `submitted`, `verified`, `verified_manual`, `rejected`.
2. **Table: `documents`**
   * `id` (uuid, primary key, default gen_random_uuid())
   * `title` (text, not null)
   * `type` (document_type_enum, not null)
   * `file_path` (text, not null)
   * `created_by` (uuid, references profiles(id), not null)
   * `created_at` (timestamptz, default now())
   * `expires_at` (timestamptz, nullable)
3. **Table: `document_signatures`**
   * `id` (uuid, primary key, default gen_random_uuid())
   * `document_id` (uuid, references documents(id), on delete cascade, not null)
   * `activity_id` (uuid, references activities(id), on delete cascade, nullable)
   * `primary_member_id` (uuid, references profiles(id), on delete cascade, not null)
   * `additional_names` (text array, default '{}')
   * `signer_printed_name` (text, nullable)
   * `status` (signature_status_enum, default 'pending')
   * `signature_path` (text, nullable)
   * `selfie_path` (text, nullable)
   * `verified_by` (uuid, references profiles(id), nullable)
   * `verified_at` (timestamptz, nullable)
   * `created_at` (timestamptz, default now())
   * `updated_at` (timestamptz, default now())
4. **Triggers:** Add an `on_updated_at` trigger to `document_signatures`.

### 2.2 Storage Buckets
Ensure the creation of two buckets via migration or admin script:
1. `choir_documents`: Public or Authenticated-Read bucket for PDF templates.
2. `member_signatures`: Strictly PRIVATE bucket for PNGs and JPGs.

### 2.3 Row Level Security (RLS)
1. **`documents` Table:**
   * `SELECT`: Authenticated users can read.
   * `INSERT/UPDATE/DELETE`: Only `director` or `super_admin` roles.
2. **`document_signatures` Table:**
   * `SELECT`: Members can read rows where `primary_member_id = auth.uid()`. Admins can read all.
   * `UPDATE`: Members can only update their own rows (and only specific fields like `status`, paths, names). Admins can update all.
3. **`member_signatures` Bucket:**
   * `SELECT`: Restricted to `primary_member_id = auth.uid()` OR admin roles.
   * `INSERT/UPDATE/DELETE`: Restricted to `primary_member_id = auth.uid()` OR admin roles.

### 2.4 Data Retention (Privacy Policy)
* Create a `pg_cron` job (or define the SQL logic for it) to run daily:
  * Find records in `document_signatures` where `status = 'verified'` AND `verified_at < now() - interval '30 days'`.
  * The job must execute the deletion of the actual files from the `member_signatures` bucket via Supabase Storage API, then set `signature_path = null` and `selfie_path = null` in the database. DO NOT delete the database row; the audit trail (`verified_by`, `verified_at`) must remain permanently.

---

## 3. PHASE 2: Admin Upload & Distribution Flow
**Task:** Build the UI and Server Actions for admins to manage documents.

### 3.1 Upload UI (`src/app/(admin)/documents/page.tsx`)
* Build a drag-and-drop or file-input component for PDFs only (`accept="application/pdf"`).
* Form fields: Document Title, Document Type (Select).
* Action: Upload file to `choir_documents` bucket, then `INSERT` into `documents` table.

### 3.2 Distribution Modal & Action
* In the document list, add a "Distribute" button opening a modal.
* **Target Activity:** Optional dropdown linking to existing upcoming calendar activities.
* **Target Selection:** 
  * "Quick Select: All Under 18" toggle. (Calculate age based on `profiles.birthdate` > current date - 18 years).
  * A scrollable, searchable checkbox list of all active choir members.
* **Server Action (`distributeDocumentAction`):**
  * Accepts `documentId`, `activityId` (optional), and an array of `memberIds`.
  * Validates admin role.
  * Loops through `memberIds` and performs a bulk `INSERT` into `document_signatures` with `status = 'pending'`.
  * Calls `revalidatePath`.

---

## 4. PHASE 3: Mobile Member Signing Flow (The UX)
**Task:** Build the secure, touch-optimized signing interface for users.

### 4.1 Access & Alerts
* On the main member dashboard (`src/app/(member)/dashboard`), query for any `document_signatures` where `primary_member_id = user.id` AND `status IN ('pending', 'rejected')`.
* If found, render a prominent, non-dismissible banner or full-screen overlay forcing them to `<Link href="/sign/[signature_id]">`.

### 4.2 PDF Rendering (`react-pdf`)
* Do NOT use `<iframe>` or `<embed>`.
* Implement `react-pdf` to render the PDF document.
* Add pagination controls (Previous/Next Page) below the PDF canvas to prevent mobile scrolling conflicts.

### 4.3 Multi-Dependent Input Form
* **Question:** "Are you signing for anyone else?"
* **Action:** "+ Add another name" button.
* **State Management:** Use a React state array `[{ id: 1, value: '' }]` to render dynamic text inputs.
* **Required Input:** "Printed Name of Signer (Parent/Guardian if under 18, Self if 18+)".

### 4.4 Capture Mechanisms (CRITICAL MOBILE UX)
* **Signature Pad:**
  * Use a `<canvas>` element (or a robust wrapper like `react-signature-canvas`).
  * **Crucial CSS:** The canvas container MUST have `touch-action: none;` to prevent Capacitor Android WebViews from scrolling the page when the user tries to draw.
  * Include a "Clear Signature" button.
* **Selfie Capture:**
  * Use standard HTML5: `<input type="file" accept="image/*" capture="user" />`.
  * **Compression:** Implement `browser-image-compression`. Compress the image client-side before uploading (Max size: 1MB, Max width: 1024px) to prevent payload limits and save bucket storage.

### 4.5 Submission & Retraction Actions
* **Capacitor Back Button:** Use `@capacitor/app` `App.addListener('backButton')`. If `isSubmitting === true`, prevent default behavior and show a toast: "Please wait, uploading..."
* **Cache-Busting Filenames:** Generate filenames using `uuidv4()` or timestamps: `[signature_id]_sig_[timestamp].png`.
* **Server Action (`submitSignatureAction`):**
  * Accepts: `signatureId`, `additionalNames` (array), `signerPrintedName`, `signatureFile` (FormData), `selfieFile` (FormData).
  * Validates payload with Zod.
  * Uploads both files to `member_signatures`.
  * `UPDATE document_signatures SET status = 'submitted', additional_names = ..., signer_printed_name = ...`
* **Retract Action:** If the document is viewed and `status === 'submitted'`, show a "Retract & Re-sign" button. Action deletes storage files and resets status to `pending`.

---

## 5. PHASE 4: Admin Verification Dashboard
**Task:** Build the rapid-approval grid UI for Directors.

### 5.1 Verification Grid (`src/app/(admin)/verifications/page.tsx`)
* Fetch all `document_signatures` where `status = 'submitted'`. Includes joined data from `profiles` and `documents`.
* Display responsive cards (1 column mobile, 3-4 columns desktop).
* **Card Data:**
  * Primary Member Name & Avatar.
  * Badge: "+[X] Dependents" (Hover/Click to see exact typed names).
  * Text: "Signed by: [signer_printed_name]".
  * Images: Signature and Selfie thumbnails. (Generate short-lived Signed URLs from the private bucket for rendering).

### 5.2 Bulk Approval
* Add a checkbox to each card and a "Select All" toggle.
* Create a sticky bottom bar: "Approve [X] Selected".
* **Server Action (`bulkVerifySignaturesAction`):**
  * `UPDATE document_signatures SET status = 'verified', verified_by = [admin_id], verified_at = now() WHERE id IN (...)`.

### 5.3 Reject & Manual Override
* **Reject Button:** On each card.
  * Server Action: Deletes the signature and selfie files from Storage to save space. Updates `status = 'rejected'`. (This forces the banner to reappear for the member).
* **Manual Clear Button:** "Manually Cleared (Paper on File)".
  * Server Action: Updates `status = 'verified_manual'`, logs `verified_by` and `verified_at`. Bypasses digital image requirements.

---
**COMPLIANCE CHECK:** Read carefully. Begin with Phase 1. Do not proceed to Phase 2 until instructed.