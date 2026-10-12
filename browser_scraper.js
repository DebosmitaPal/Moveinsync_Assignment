/**
 * ==============================================================================
 * BROWSER CONSOLE MOVEINSYNC REVIEW SCRAPER & COMPLAINT CATEGORIZER
 * ==============================================================================
 * 
 * HOW TO USE THIS SCRIPT DIRECTLY IN YOUR BROWSER:
 * 1. Open Google Chrome or any Chromium browser.
 * 2. Navigate to MoveInSync on Google Play Store:
 *    https://play.google.com/store/apps/details?id=com.moveinsync.ets
 * 3. Click on "See all reviews" to open the reviews modal.
 * 4. Press F12 (or right-click -> Inspect) and switch to the "Console" tab.
 * 5. Paste this entire code and press Enter.
 * 6. The script will automatically:
 *    - Auto-scroll the reviews dialog to load reviews.
 *    - Automatically expand truncated review texts ("Show full review").
 *    - Extract Reviewer Name, Rating (1-5), Date, Thumbs Up, and Review Text.
 *    - Categorize complaints into Cab Delay, Tracking/GPS, OTP/Auth, Driver Behavior, etc.
 *    - Automatically download both CSV (for Excel) and JSON files!
 * ==============================================================================
 */

(async function autoCollectAndExportMoveInSyncReviews() {
  console.log("%c[MoveInSync Scraper] Starting automated collection...", "color: #2b6cb0; font-weight: bold; font-size: 14px;");

  const MAX_REVIEWS_TO_COLLECT = 300; // Adjust as needed
  const SCROLL_INTERVAL_MS = 1200;

  // 1. Complaint Categorization Engine
  const CATEGORIES = [
    {
      name: 'OTP & Login / Auth Issues',
      regex: /\b(otp|login|password|sign\s*in|verification|view otp|seat\s*belt|sms|auth)\b/i
    },
    {
      name: 'Cab Delay & Punctuality',
      regex: /\b(late|delay|delayed|waiting|reschedul|punctual|reach late|wait for|time waste)\b/i
    },
    {
      name: 'Live Tracking & GPS Navigation',
      regex: /\b(tracking|gps|live location|location|map|route|wrong route|navigation|beacon)\b/i
    },
    {
      name: 'App Crashes, Bugs & Freezing',
      regex: /\b(crash|bug|hang|freeze|blank screen|white screen|not opening|slow|lag|error|stuck|loading)\b/i
    },
    {
      name: 'Driver Behavior & Safety',
      regex: /\b(driver|rude|behaviour|behavior|rash|reckless|speed|harass|abusive|unprofessional|safety|unsafe)\b/i
    },
    {
      name: 'Cab Allocation & Cancellation',
      regex: /\b(no cab|allocation|not assigned|cancelled|dropped ride|no show|seat)\b/i
    },
    {
      name: 'UI / UX & Update Dissatisfaction',
      regex: /\b(update|new update|ui|user interface|annoying|clicks|worst update|complicated|confusing)\b/i
    },
    {
      name: 'Customer Support & Helpdesk',
      regex: /\b(support|helpdesk|customer care|helpline|ticket|escalat)\b/i
    }
  ];

  function categorize(text, rating) {
    if (!text) {
      return {
        primary: rating >= 4 ? 'Positive / Unspecified' : 'Unspecified Issue',
        sentiment: rating >= 4 ? 'Positive' : (rating <= 2 ? 'Negative' : 'Neutral')
      };
    }

    const matched = [];
    for (const cat of CATEGORIES) {
      if (cat.regex.test(text)) {
        matched.push(cat.name);
      }
    }

    let sentiment = rating >= 4 ? 'Positive' : (rating <= 2 ? 'Negative' : 'Neutral');
    let primary = 'General / Other';

    if (matched.length > 0) {
      primary = matched[0];
    } else if (rating >= 4) {
      primary = 'Appreciation / Positive Feedback';
    } else if (rating <= 2) {
      primary = 'General Dissatisfaction';
    }

    return { primary, secondary: matched.slice(1).join('; '), sentiment };
  }

  // 2. Find review modal / scroll container
  const modalScrollContainer = document.querySelector('div[role="dialog"] div[tabindex="-1"]') || 
                               document.querySelector('div[role="dialog"]') ||
                               window;

  // 3. Helper to expand all truncated reviews
  function expandTruncatedReviews() {
    const expandButtons = document.querySelectorAll('button[aria-label*="full review"], button[aria-expanded="false"], div[role="button"][jsname]');
    expandButtons.forEach(btn => {
      try {
        if (btn.innerText && btn.innerText.toLowerCase().includes('full')) {
          btn.click();
        }
      } catch (e) {}
    });
  }

  // 4. Auto-scroll loop
  let previousCount = 0;
  let stagnantTurns = 0;

  console.log("[MoveInSync Scraper] Auto-scrolling to load reviews...");

  while (true) {
    expandTruncatedReviews();
    const currentReviews = document.querySelectorAll('header, div.RHo1pe, div[jscontroller][data-parent-id]');
    
    // Check if reached desired count or stagnant
    if (currentReviews.length >= MAX_REVIEWS_TO_COLLECT) {
      console.log(`[MoveInSync Scraper] Reached target review threshold: ${currentReviews.length}`);
      break;
    }

    if (currentReviews.length === previousCount) {
      stagnantTurns++;
      if (stagnantTurns > 5) {
        console.log("[MoveInSync Scraper] No more new reviews loading. Proceeding to extract.");
        break;
      }
    } else {
      stagnantTurns = 0;
      previousCount = currentReviews.length;
    }

    // Scroll container
    if (modalScrollContainer === window) {
      window.scrollBy(0, 1000);
    } else if (modalScrollContainer.scrollBy) {
      modalScrollContainer.scrollBy(0, 1200);
    } else {
      modalScrollContainer.scrollTop += 1200;
    }

    await new Promise(r => setTimeout(r, SCROLL_INTERVAL_MS));
  }

  // Final expand pass
  expandTruncatedReviews();
  await new Promise(r => setTimeout(r, 1000));

  // 5. Extract Reviews
  const reviewContainers = document.querySelectorAll('div.RHo1pe');
  const results = [];

  reviewContainers.forEach((el, index) => {
    try {
      // User name
      const authorEl = el.querySelector('.X5PpBb') || el.querySelector('header span');
      const author = authorEl ? authorEl.innerText.trim() : 'Anonymous';

      // Rating
      const ratingEl = el.querySelector('div[role="img"][aria-label*="star"], div[role="img"][aria-label*="Star"]');
      let rating = 0;
      if (ratingEl) {
        const aria = ratingEl.getAttribute('aria-label') || '';
        const match = aria.match(/(\d+)/);
        if (match) rating = parseInt(match[1], 10);
      }

      // Date
      const dateEl = el.querySelector('.bp9Aid') || el.querySelector('header + div span');
      const date = dateEl ? dateEl.innerText.trim() : '';

      // Text
      const textEl = el.querySelector('.h3YV2d') || el.querySelector('div[data-expandable-optional]');
      const text = textEl ? textEl.innerText.trim() : '';

      // Thumbs up
      const thumbsEl = el.querySelector('.AJFgb') || el.querySelector('div[aria-label*="helpful"]');
      let thumbsUp = 0;
      if (thumbsEl) {
        const match = thumbsEl.innerText.match(/\d+/);
        if (match) thumbsUp = parseInt(match[0], 10);
      }

      const catInfo = categorize(text, rating);

      results.push({
        id: index + 1,
        author,
        date,
        rating,
        sentiment: catInfo.sentiment,
        primaryCategory: catInfo.primary,
        secondaryIssues: catInfo.secondary,
        reviewText: text,
        thumbsUp
      });
    } catch (err) {
      console.warn("Error parsing individual review element:", err);
    }
  });

  console.log(`%c[MoveInSync Scraper] Successfully extracted ${results.length} reviews!`, "color: #38a169; font-weight: bold; font-size: 14px;");

  // 6. Direct Browser Download Helpers
  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Download JSON
  downloadFile(JSON.stringify(results, null, 2), 'moveinsync_playstore_reviews.json', 'application/json');

  // Convert & Download CSV
  function escapeCsv(str) {
    if (!str) return '""';
    return `"${String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  }

  const csvRows = [
    ['Index', 'Date', 'User Name', 'Rating', 'Sentiment', 'Primary Category', 'Secondary Issues', 'Review Text', 'Thumbs Up'].map(escapeCsv).join(','),
    ...results.map(r => [
      r.id,
      escapeCsv(r.date),
      escapeCsv(r.author),
      r.rating,
      escapeCsv(r.sentiment),
      escapeCsv(r.primaryCategory),
      escapeCsv(r.secondaryIssues),
      escapeCsv(r.reviewText),
      r.thumbsUp
    ].join(','))
  ];

  downloadFile(csvRows.join('\r\n'), 'moveinsync_playstore_reviews.csv', 'text/csv;charset=utf-8;');
  console.log("%c[MoveInSync Scraper] Downloads triggered: JSON and CSV files saved to your Downloads folder!", "color: #38a169; font-weight: bold;");

  return results;
})();
