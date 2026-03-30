# School Calendar CSV Date Range Filter

## Overview

When importing School Calendar entries via CSV, the import dialog now includes date range inputs to filter imported entries to only those within the program's active period.

## How It Works

1. **Pre-filled Dates:** When you open the CSV import dialog, the "First Day" and "Last Day" inputs are automatically populated with your program's start and end dates.

2. **Automatic Filtering:** As soon as you upload a CSV file, only rows with dates between the specified range (inclusive) are shown in the preview.

3. **Adjustable Range:** You can manually adjust the date range before importing if you want to restrict the import to a subset of the program period.

4. **Import Only Visible Rows:** Only the filtered rows visible in the preview will be imported when you click "Import."

## Example

**Program Dates:** September 1, 2026 – June 30, 2027

**CSV File:**
```csv
date,description,status_type
2025-12-25,Old Holiday,no_school
2026-09-01,Labor Day,no_school
2026-11-26,Thanksgiving,no_school
2027-08-15,Future Event,no_school
```

**Result:** Only 2 rows imported (Labor Day, Thanksgiving). Old Holiday and Future Event excluded.

## Benefits

- **Prevents accidental imports** of old or future calendar entries
- **Reduces clutter** in the calendar view
- **Saves time** — no need to manually remove out-of-range entries after import
- **Flexible** — adjust the range if you need to import historical or future data

## FAQ

### Can I disable the filter?

Clear both date inputs to disable filtering and see all rows.

### Are boundary dates included?

Yes, the filter is inclusive. Dates matching the start or end date are included.

### What happens to rows without a date?

Rows without a valid date in the "date" column are excluded from the preview and import.

### Can I change the date range after uploading the CSV?

Yes! Adjust the date inputs and the preview updates immediately. Import respects the current date range.
