# MoveInSync Play Store Review & Complaint Intelligence Toolkit

Automated JavaScript tool to collect public reviews and ratings for **MoveInSync** (`com.moveinsync.ets`) from Google Play Store without manually opening each review, categorize complaints, and export to **Excel (.xlsx)**, **CSV**, and **JSON**.

---

## 📁 Generated Output Files (Ready in this Folder)

| File | Description | Records |
| :--- | :--- | :--- |
| **[`moveinsync_reviews.xlsx`](file:///e:/Moveinsync/moveinsync_reviews.xlsx)** | **Professional Excel Workbook** with 3 sheets: Executive Summary & Category Breakdown, All Reviews, and Filtered Categorized Complaints (with color-coded ratings & auto-filters). | 1,500 Reviews |
| **[`moveinsync_reviews.csv`](file:///e:/Moveinsync/moveinsync_reviews.csv)** | Clean CSV file formatted for direct import into Google Sheets, Excel, or BI tools. | 1,500 Reviews |
| **[`moveinsync_reviews.json`](file:///e:/Moveinsync/moveinsync_reviews.json)** | Complete structured JSON dataset with metadata, dates, sentiment, and categories. | 1,500 Reviews |

---

## 📊 Summary of Collected MoveInSync Reviews

From the expanded collection of **1,500 reviews**:

- **App ID**: `com.moveinsync.ets` (MoveInSync Employee Commute)
- **Positive Reviews (4-5★)**: 1,042 (69.5%)
- **Negative Reviews (1-2★)**: 419 (27.9%)
- **Neutral Reviews (3★)**: 39 (2.6%)

### 🏷️ Top Categorized Complaint Clusters:
1. **UI / UX & Update Dissatisfaction** (71 complaints): Extra friction, annoying popups (such as seatbelt confirmation prior to viewing OTP), interface redesign changes.
2. **Live Tracking & GPS Navigation** (69 complaints): Real-time tracking lagging, incorrect vehicle pin on map, navigation deviation.
3. **App Crashes, Bugs & Freezing** (55 complaints): App hanging, blank/white screen, slow response times.
4. **OTP & Login / Auth Issues** (53 complaints): Delays fetching OTP, SMS delivery issues, authentication hurdles.
5. **Driver Behavior & Safety** (50 complaints): Rude attitude, rash driving, arbitrary cancellations, phone usage while driving.
6. **Cab Delay & Punctuality** (29 complaints): Late pickups, waiting for long durations, timing unpredictability.
7. **Cab Allocation & Ride Cancellation** (13 complaints): Dropped rides, no cab assigned, no-shows.
8. **Customer Support & Helpdesk** (13 complaints): Escalation responsiveness and SOS support.
9. **Battery Drain & Background Permissions** (3 complaints): Excessive power draw during trip tracking.

---

## 🚀 How to Run the Scripts

### Method 1: Node.js Automated Script (Recommended)

To refresh or collect more reviews automatically:

```bash
# Collect up to 500-1000 reviews and refresh Excel, CSV, and JSON
node collect_reviews.js
```

You can change `targetCount = 500` inside [`collect_reviews.js`](file:///e:/Moveinsync/collect_reviews.js) to any target number (e.g., `1000`, `2000`).

---

### Method 2: Browser Console Script (Zero Installation)

If you prefer collecting directly from your browser without Node.js:

1. Open Google Chrome or Microsoft Edge.
2. Go to the [MoveInSync Google Play Store Page](https://play.google.com/store/apps/details?id=com.moveinsync.ets).
3. Click **"See all reviews"** to open the reviews popup.
4. Press `F12` to open Developer Tools, and switch to the **Console** tab.
5. Copy and paste the contents of [`browser_scraper.js`](file:///e:/Moveinsync/browser_scraper.js) and press `Enter`.
6. The script will automatically:
   - Auto-scroll the review feed.
   - Expand all truncated review texts ("Show full review").
   - Categorize each complaint in real-time.
   - Automatically download `moveinsync_playstore_reviews.csv` and `.json` directly to your browser's Downloads folder!
