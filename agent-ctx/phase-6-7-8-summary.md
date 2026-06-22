# Phase 6, 7, 8 Implementation Summary

## Files Created

### Phase 6: Document System
- **`supabase/functions/document-engine/index.ts`** — Edge function with 3 actions:
  - `upload_url`: Generates signed upload URL for Supabase Storage (bucket: `documents`), returns upload URL + public URL
  - `delete`: Deletes file from storage, marks document record as 'Deleted'
  - `list`: Lists all non-deleted documents for a lead with public URLs
  - Uses SERVICE_ROLE_KEY for storage admin access

- **`supabase/migrations/20260621020000_phase6_document_storage.sql`** — Migration:
  - Creates `documents` storage bucket (private, 10MB limit, restricted MIME types)
  - RLS policies for storage objects (CRUD for authenticated users)
  - Adds `file_url` (text), `file_size` (integer), `version` (integer default 1) to documents table
  - Updates status check constraint to include 'Deleted'
  - Adds indexes

### Phase 6b: Updated LeadDetail.tsx Documents Tab
- Added document type selector (KYC, Agreement, Proposal, Invoice, Payment Proof, Other)
- File upload via document-engine signed URLs
- Document preview for images (thumbnail display)
- Download button (opens public URL)
- Delete button (calls document-engine delete)
- Verify/Reject action buttons
- Expandable version history panel with created_at, status, file size, version
- Loading spinner during uploads
- File type icons (Image, FileText, File) based on extension

### Phase 7: Invoice System
- **`src/pages/Invoices.tsx`** — Complete rewrite:
  - 3 summary cards (Pending, Paid, Overdue with counts)
  - Line items in create modal (item name, description, qty, rate, auto-calculated amount, item_type selector)
  - Auto-recalculated total from line items (qty × rate)
  - Invoice detail modal (click row to expand):
    - Lead info (name, email, mobile, city/state)
    - Line items table with subtotal
    - GST calculation (CGST 9%, SGST 9%)
    - Grand total
    - Payment history section
    - Action buttons: Print/PDF, Mark Paid, Send Payment Link, Mark Overdue, Delete
  - Mark as Paid modal (amount, method, reference/transaction ID)
  - Payment Link modal (copy link, open link)
  - PDF generation (calls invoice-pdf edge function, opens HTML in new tab with print)

- **`supabase/functions/invoice-pdf/index.ts`** — Edge function:
  - `generate` action: Produces a professional HTML invoice template
  - Company branding (Franchisee Kart AIOS)
  - Bill-to section with lead details
  - Line items table
  - Tax breakdown (CGST/SGST 9%)
  - Bank details section
  - Print/PDF button built into HTML
  - Returns HTML with text/html content-type

- **`supabase/functions/payment-link/index.ts`** — Edge function:
  - `create`: Creates payment record, generates Razorpay payment link if keys configured, otherwise placeholder link
  - `verify`: Checks for confirmed payments on invoice, auto-marks invoice as Paid

### Phase 8: Calendar System
- **`src/pages/Calendar.tsx`** — Full calendar page (730 lines):
  - **Month View**: 6×7 grid with proper first-day offset, meeting dots, today highlight, click to create
  - **Week View**: 7-column × 24-hour time slot grid, meeting cards at correct hours
  - **Day View**: Single-day timeline with 24-hour slots, full meeting cards with lead/consultant info
  - **View toggle**: Same pattern as Leads.tsx (Month/Week/Day buttons, blue-600 active state)
  - **Navigation**: Prev/Next arrows, Today button, header text (month name, date range, etc.)
  - **Consultant filter**: Dropdown to filter by assigned consultant
  - **Stats row**: 4 cards (Scheduled=blue, Completed=emerald, Cancelled=red, No Show=amber)
  - **Color coding**: Status-based colors for meeting dots and cards
  - **Meeting detail modal**: Shows lead info (clickable → navigates to lead), time, consultant, notes, status badge, status actions (Complete, No Show, Cancel, Reschedule)
  - **Create meeting modal**: Lead selector, date/time picker, consultant assign, notes
  - **Click on empty day/time** to create meeting at that slot
  - Pure CSS/React — no external calendar library

### Routing & Navigation
- **`src/AppRouter.tsx`**: Added `import CalendarPage` and `<Route path="calendar" element={<CalendarPage />} />`
- **`src/components/Layout.tsx`**: Added Calendar nav item with CalendarDays icon, accessible to all roles

## Design System Compliance
- Dark theme: `bg-slate-900` cards, `border-slate-800` borders
- Blue-600/Cyan-600 gradients on primary buttons
- `rounded-2xl` corners on all cards
- Same spinner pattern: `border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin`
- Same modal pattern: `fixed inset-0 z-50 bg-black/70 backdrop-blur-sm`
- Lucide React icons throughout
- Responsive layouts with grid cols
- `max-h-[500px] overflow-y-auto` for scrollable lists