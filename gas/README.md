# Google Apps Script — Automation Lab Tools

Each script in this directory is a backend for one of the Automation Lab tools. Deploy each as a Google Apps Script web app to enable Google Sheets sync.

---

## How to Deploy

1. Go to [script.google.com](https://script.google.com) and create a new project
2. Paste the contents of the relevant `Code.gs` file
3. Click **Deploy → New deployment**
4. Set type to **Web app**
5. Set **Execute as: Me**
6. Set **Who has access: Anyone**
7. Click **Deploy** and copy the web app URL
8. Paste the URL into the tool's "Connect Google Sheet" panel on the site

---

## Scripts

### `donation-receipts/Code.gs`
Tracks tax-deductible donations with auto-generated receipt numbers (RCP-YEAR-XXXX).  
Sheet: `Donations` — columns: ID, Date, DonorName, DonorEmail, Amount, Purpose, ReceiptNumber, CreatedAt  
**Site storage key:** `gas-url-donation-receipts`

### `volunteer-tracker/Code.gs`
Logs volunteer hours by name, activity, and date. Provides leaderboard and totals.  
Sheet: `VolunteerHours` — columns: ID, VolunteerName, Email, Date, Hours, Activity, Notes, CreatedAt  
**Site storage key:** `gas-url-volunteer-tracker`

### `event-scheduler/Code.gs`
Manages event schedules with speaker, location, and time slots. Supports bulk import.  
Sheet: `EventSchedule` — columns: ID, EventName, Date, StartTime, EndTime, Location, Speaker, Notes, CreatedAt  
**Site storage key:** `gas-url-event-scheduler`

### `mail-merge/Code.gs`
Applies `{{field}}` templates to rows from a Google Sheet and sends via Gmail.  
Uses the active spreadsheet's sheets as data sources.  
**Site storage key:** `gas-url-mail-merge`

### `event-attendance/Code.gs`
Compares registration vs check-in lists to find attended, no-shows, and walk-ins.  
Sheets: `Registrations` (Name, Email, Event) and `CheckIns` (Name, Email, Event, CheckInTime)  
**Site storage key:** `gas-url-event-attendance`

### `donor-thankyou/Code.gs`
Generates personalized thank-you letters from donor data and sends via Gmail.  
Sheet: `DonorThankYou` — columns: ID, DonorName, Email, Amount, Date, LetterContent, SentAt, CreatedAt  
**Site storage key:** `gas-url-donor-thankyou`

### `budget-tracker/Code.gs`
Tracks budgeted vs actual spending by category and period with variance calculations.  
Sheet: `BudgetVsActual` — columns: ID, Category, BudgetAmount, ActualAmount, Period, Notes, CreatedAt  
**Site storage key:** `gas-url-budget-tracker`

---

## Offline Mode

All tools work without a GAS URL — data is stored in browser `localStorage`. Connect a Google Sheet any time to sync your data to the cloud.
