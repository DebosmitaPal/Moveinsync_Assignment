const gplay = (require('google-play-scraper').default || require('google-play-scraper'));
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// 1. Complaint Categorization Rules
const CATEGORY_RULES = [
  {
    category: 'OTP & Login / Auth Issues',
    keywords: [/\botp\b/i, /login/i, /password/i, /sign\s*in/i, /verification/i, /view otp/i, /seat\s*belt/i, /sms/i, /auth/i]
  },
  {
    category: 'Cab Delay & Punctuality',
    keywords: [/\blate\b/i, /\bdelay(ed)?\b/i, /waiting/i, /reschedul/i, /punctual/i, /reach(ed)? late/i, /wait for/i, /waste of time/i, /in time/i]
  },
  {
    category: 'Live Tracking & GPS Navigation',
    keywords: [/tracking/i, /\bgps\b/i, /live location/i, /location/i, /\bmap\b/i, /wrong route/i, /navigation/i, /beacon/i, /wrong location/i]
  },
  {
    category: 'App Crashes, Bugs & Performance',
    keywords: [/crash/i, /\bbug(s)?\b/i, /\bhang(s)?\b/i, /freez/i, /blank screen/i, /white screen/i, /not open/i, /slow/i, /\blag\b/i, /error/i, /stuck/i, /loading/i]
  },
  {
    category: 'Driver Behavior & Safety',
    keywords: [/driver/i, /rude/i, /behavio(u)?r/i, /rash/i, /reckless/i, /speed/i, /harass/i, /abus(e|ive)/i, /unprofessional/i, /argument/i, /safety/i, /unsafe/i]
  },
  {
    category: 'Cab Allocation & Cancellation',
    keywords: [/no cab/i, /allocat/i, /not assigned/i, /cancell?ed/i, /drop(ped)? ride/i, /no show/i, /cab not/i, /seat/i, /cab arrival/i, /pickup/i]
  },
  {
    category: 'UI / UX & Update Dissatisfaction',
    keywords: [/new update/i, /update/i, /ui/i, /user interface/i, /annoying/i, /clicks/i, /worst update/i, /bad update/i, /complicated/i, /confusing/i, /interface/i]
  },
  {
    category: 'Customer Support & Helpdesk',
    keywords: [/support/i, /helpdesk/i, /customer care/i, /helpline/i, /no response/i, /ticket/i, /escalat/i, /sos/i]
  },
  {
    category: 'Battery Drain & Permissions',
    keywords: [/battery/i, /drain/i, /permission/i, /heating/i, /background/i]
  }
];

function categorizeReview(text, score) {
  if (!text) {
    if (score >= 4) return { primary: 'Positive / Unspecified', secondary: [], sentiment: 'Positive' };
    if (score <= 2) return { primary: 'Unspecified Complaint', secondary: [], sentiment: 'Negative' };
    return { primary: 'Neutral / General', secondary: [], sentiment: 'Neutral' };
  }

  const matchedCategories = [];
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (kw.test(text)) {
        if (!matchedCategories.includes(rule.category)) {
          matchedCategories.push(rule.category);
        }
        break;
      }
    }
  }

  // Sentiment determination
  let sentiment = 'Neutral';
  if (score >= 4) {
    sentiment = 'Positive';
  } else if (score <= 2) {
    sentiment = 'Negative';
  } else {
    sentiment = 'Neutral';
  }

  let primary = 'General / Other';
  let secondary = [];

  if (matchedCategories.length > 0) {
    primary = matchedCategories[0];
    secondary = matchedCategories.slice(1);
  } else if (score >= 4) {
    primary = 'Appreciation / Positive Feedback';
  } else if (score <= 2) {
    primary = 'General Dissatisfaction';
  } else {
    primary = 'General Feedback';
  }

  return { primary, secondary, sentiment };
}

// 2. Fetch reviews with pagination across multiple sort orders
async function collectMoveInSyncReviews(targetCount = 1500) {
  console.log(`Starting expanded collection for 'com.moveinsync.ets' (Target: ~${targetCount} reviews)...`);
  
  const allReviewsMap = new Map();
  const sortModes = [
    { name: 'NEWEST', sort: gplay.sort.NEWEST },
    { name: 'HELPFULNESS', sort: gplay.sort.HELPFULNESS },
    { name: 'RATING', sort: gplay.sort.RATING }
  ];

  for (const mode of sortModes) {
    if (allReviewsMap.size >= targetCount) break;

    console.log(`\n--- Fetching via sort order: ${mode.name} ---`);
    let nextPaginationToken = null;
    let batch = 1;
    const maxBatchesPerMode = 10;

    while (allReviewsMap.size < targetCount && batch <= maxBatchesPerMode) {
      try {
        console.log(`Fetching ${mode.name} batch #${batch} (Unique reviews collected so far: ${allReviewsMap.size})...`);
        const opts = {
          appId: 'com.moveinsync.ets',
          sort: mode.sort,
          num: 150,
          paginate: true
        };
        if (nextPaginationToken) {
          opts.nextPaginationToken = nextPaginationToken;
        }

        const res = await gplay.reviews(opts);
        if (!res.data || res.data.length === 0) {
          console.log(`No more reviews returned for sort ${mode.name}.`);
          break;
        }

        for (const r of res.data) {
          if (!allReviewsMap.has(r.id)) {
            allReviewsMap.set(r.id, r);
          }
        }

        nextPaginationToken = res.nextPaginationToken;
        batch++;

        if (!nextPaginationToken) {
          console.log(`Reached end of stream for sort ${mode.name}.`);
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (err) {
        console.error(`Error in ${mode.name} batch ${batch}:`, err.message);
        break;
      }
    }
  }

  const allReviews = Array.from(allReviewsMap.values());
  console.log(`Successfully collected ${allReviews.length} unique reviews.`);

  // 3. Process & Categorize
  const processed = allReviews.map(r => {
    const cat = categorizeReview(r.text, r.score);
    return {
      reviewId: r.id,
      userName: r.userName || 'Anonymous',
      date: r.date ? new Date(r.date).toISOString().replace('T', ' ').substring(0, 19) : '',
      score: r.score,
      sentiment: cat.sentiment,
      primaryCategory: cat.primary,
      secondaryCategories: cat.secondary.join('; '),
      reviewText: r.text || '',
      appVersion: r.version || 'N/A',
      thumbsUp: r.thumbsUp || 0,
      replyDate: r.replyDate ? new Date(r.replyDate).toISOString().replace('T', ' ').substring(0, 19) : '',
      replyText: r.replyText || '',
      reviewUrl: r.url || ''
    };
  });

  return processed;
}

// 4. Save to JSON and CSV
function exportJsonAndCsv(data, outputDir) {
  const jsonPath = path.join(outputDir, 'moveinsync_reviews.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved JSON: ${jsonPath}`);

  const csvPath = path.join(outputDir, 'moveinsync_reviews.csv');
  const headers = [
    'Review ID',
    'Date (UTC)',
    'User Name',
    'Rating (Stars)',
    'Sentiment',
    'Primary Category',
    'Secondary Categories',
    'Review Text',
    'App Version',
    'Thumbs Up',
    'Developer Replied',
    'Developer Reply',
    'Review URL'
  ];

  function escapeCsv(val) {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return `"${s}"`;
  }

  const rows = [
    headers.map(h => `"${h}"`).join(','),
    ...data.map(d => [
      escapeCsv(d.reviewId),
      escapeCsv(d.date),
      escapeCsv(d.userName),
      d.score,
      escapeCsv(d.sentiment),
      escapeCsv(d.primaryCategory),
      escapeCsv(d.secondaryCategories),
      escapeCsv(d.reviewText),
      escapeCsv(d.appVersion),
      d.thumbsUp,
      escapeCsv(d.replyText ? 'Yes' : 'No'),
      escapeCsv(d.replyText),
      escapeCsv(d.reviewUrl)
    ].join(','))
  ];

  fs.writeFileSync(csvPath, rows.join('\r\n'), 'utf8');
  console.log(`Saved CSV: ${csvPath}`);
}

// 5. Generate Styled Excel Sheet
async function exportExcel(data, outputDir) {
  const excelPath = path.join(outputDir, 'moveinsync_reviews.xlsx');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MoveInSync Review Collector';
  workbook.created = new Date();

  // ----- SHEET 1: EXECUTIVE SUMMARY -----
  const summarySheet = workbook.addWorksheet('Executive Summary', {
    views: [{ showGridLines: true }]
  });

  summarySheet.columns = [
    { width: 5 },
    { width: 35 },
    { width: 18 },
    { width: 22 },
    { width: 20 }
  ];

  // Title block
  summarySheet.mergeCells('B2:E2');
  const titleCell = summarySheet.getCell('B2');
  titleCell.value = 'MoveInSync (ETS) - Play Store Review & Complaint Intelligence';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A365D' } // Deep Navy
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(2).height = 40;

  // Subtitle
  summarySheet.mergeCells('B3:E3');
  const subCell = summarySheet.getCell('B3');
  subCell.value = `Generated on: ${new Date().toLocaleString()} | Total Sample Size: ${data.length} Reviews`;
  subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF4A5568' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(3).height = 20;

  // Metric KPI Cards
  const avgRating = (data.reduce((acc, cur) => acc + cur.score, 0) / (data.length || 1)).toFixed(2);
  const negReviews = data.filter(d => d.score <= 2);
  const posReviews = data.filter(d => d.score >= 4);
  const neuReviews = data.filter(d => d.score === 3);

  const kpis = [
    { label: 'Total Reviews Analyzed', val: data.length },
    { label: 'Average Sample Rating', val: `${avgRating} / 5.0` },
    { label: 'Negative Reviews (1-2★)', val: `${negReviews.length} (${((negReviews.length / data.length) * 100).toFixed(1)}%)` },
    { label: 'Positive Reviews (4-5★)', val: `${posReviews.length} (${((posReviews.length / data.length) * 100).toFixed(1)}%)` }
  ];

  let kpiRow = 5;
  summarySheet.getCell(`B${kpiRow}`).value = 'KPI Metric';
  summarySheet.getCell(`C${kpiRow}`).value = 'Value';
  summarySheet.getCell(`B${kpiRow}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getCell(`C${kpiRow}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getCell(`B${kpiRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };
  summarySheet.getCell(`C${kpiRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

  kpis.forEach((kpi, idx) => {
    const r = kpiRow + 1 + idx;
    summarySheet.getCell(`B${r}`).value = kpi.label;
    summarySheet.getCell(`C${r}`).value = kpi.val;
    summarySheet.getCell(`B${r}`).font = { bold: true };
    summarySheet.getCell(`C${r}`).alignment = { horizontal: 'center' };
  });

  // Complaint Breakdown Table
  const catStats = {};
  data.forEach(d => {
    if (!catStats[d.primaryCategory]) {
      catStats[d.primaryCategory] = { count: 0, totalScore: 0, negCount: 0 };
    }
    catStats[d.primaryCategory].count++;
    catStats[d.primaryCategory].totalScore += d.score;
    if (d.score <= 2) catStats[d.primaryCategory].negCount++;
  });

  const catTableStart = 11;
  summarySheet.getCell(`B${catTableStart}`).value = 'Complaint / Feedback Category';
  summarySheet.getCell(`C${catTableStart}`).value = 'Total Count';
  summarySheet.getCell(`D${catTableStart}`).value = '% of Reviews';
  summarySheet.getCell(`E${catTableStart}`).value = 'Avg Rating';

  ['B', 'C', 'D', 'E'].forEach(col => {
    const c = summarySheet.getCell(`${col}${catTableStart}`);
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const sortedCats = Object.entries(catStats).sort((a, b) => b[1].count - a[1].count);
  sortedCats.forEach(([catName, stat], idx) => {
    const rowNum = catTableStart + 1 + idx;
    summarySheet.getCell(`B${rowNum}`).value = catName;
    summarySheet.getCell(`C${rowNum}`).value = stat.count;
    summarySheet.getCell(`D${rowNum}`).value = `${((stat.count / data.length) * 100).toFixed(1)}%`;
    summarySheet.getCell(`E${rowNum}`).value = (stat.totalScore / stat.count).toFixed(2);

    summarySheet.getCell(`C${rowNum}`).alignment = { horizontal: 'center' };
    summarySheet.getCell(`D${rowNum}`).alignment = { horizontal: 'center' };
    summarySheet.getCell(`E${rowNum}`).alignment = { horizontal: 'center' };
  });

  // ----- SHEET 2: ALL REVIEWS & RATINGS -----
  const allSheet = workbook.addWorksheet('All Reviews', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }]
  });

  allSheet.columns = [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'User Name', key: 'userName', width: 20 },
    { header: 'Rating ★', key: 'score', width: 12 },
    { header: 'Sentiment', key: 'sentiment', width: 14 },
    { header: 'Primary Category', key: 'primaryCategory', width: 28 },
    { header: 'Secondary Issues', key: 'secondaryCategories', width: 25 },
    { header: 'Review Content', key: 'reviewText', width: 55 },
    { header: 'App Version', key: 'appVersion', width: 14 },
    { header: 'Helpful Thumbs Up', key: 'thumbsUp', width: 18 },
    { header: 'Dev Replied?', key: 'hasReply', width: 14 },
    { header: 'Developer Reply Content', key: 'replyText', width: 40 },
    { header: 'Review Link', key: 'reviewUrl', width: 30 }
  ];

  // Header styling
  allSheet.getRow(1).height = 28;
  allSheet.getRow(1).eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  data.forEach(d => {
    const row = allSheet.addRow({
      date: d.date,
      userName: d.userName,
      score: d.score,
      sentiment: d.sentiment,
      primaryCategory: d.primaryCategory,
      secondaryCategories: d.secondaryCategories,
      reviewText: d.reviewText,
      appVersion: d.appVersion,
      thumbsUp: d.thumbsUp,
      hasReply: d.replyText ? 'Yes' : 'No',
      replyText: d.replyText,
      reviewUrl: d.reviewUrl
    });

    // Color code ratings
    const scoreCell = row.getCell('score');
    scoreCell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (d.score <= 2) {
      scoreCell.font = { bold: true, color: { argb: 'FF9B2C2C' } }; // Dark red
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEB' } }; // Light red bg
    } else if (d.score === 3) {
      scoreCell.font = { bold: true, color: { argb: 'FF975A16' } }; // Yellow/brown
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBE8' } };
    } else {
      scoreCell.font = { bold: true, color: { argb: 'FF22543D' } }; // Dark green
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FFF4' } };
    }

    // Alignment
    row.getCell('date').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('sentiment').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('appVersion').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('thumbsUp').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('hasReply').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('reviewText').alignment = { wrapText: true, vertical: 'top' };
  });

  // Auto-filter
  allSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 12 }
  };

  // ----- SHEET 3: CATEGORIZED COMPLAINTS (1-3 STARS ONLY) -----
  const complaintSheet = workbook.addWorksheet('Categorized Complaints', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }]
  });

  complaintSheet.columns = [
    { header: 'Complaint Category', key: 'primaryCategory', width: 28 },
    { header: 'Rating ★', key: 'score', width: 12 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'User Name', key: 'userName', width: 18 },
    { header: 'Detailed Issue / Review Text', key: 'reviewText', width: 60 },
    { header: 'Secondary Issues', key: 'secondaryCategories', width: 25 },
    { header: 'App Version', key: 'appVersion', width: 14 },
    { header: 'Helpful Thumbs Up', key: 'thumbsUp', width: 16 },
    { header: 'Developer Replied', key: 'hasReply', width: 15 },
    { header: 'Developer Reply Content', key: 'replyText', width: 40 }
  ];

  complaintSheet.getRow(1).height = 28;
  complaintSheet.getRow(1).eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9B2C2C' } }; // Crimson red header
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  const complaintsOnly = data.filter(d => d.score <= 3 || d.sentiment === 'Negative');
  complaintsOnly.forEach(d => {
    const row = complaintSheet.addRow({
      primaryCategory: d.primaryCategory,
      score: d.score,
      date: d.date,
      userName: d.userName,
      reviewText: d.reviewText,
      secondaryCategories: d.secondaryCategories,
      appVersion: d.appVersion,
      thumbsUp: d.thumbsUp,
      hasReply: d.replyText ? 'Yes' : 'No',
      replyText: d.replyText
    });

    const scoreCell = row.getCell('score');
    scoreCell.alignment = { horizontal: 'center', vertical: 'middle' };
    scoreCell.font = { bold: true, color: { argb: 'FF9B2C2C' } };
    scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEB' } };

    row.getCell('primaryCategory').font = { bold: true };
    row.getCell('date').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('appVersion').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('thumbsUp').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('hasReply').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('reviewText').alignment = { wrapText: true, vertical: 'top' };
  });

  complaintSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 10 }
  };

  await workbook.xlsx.writeFile(excelPath);
  console.log(`Saved Excel Workbook: ${excelPath}`);
}

async function main() {
  try {
    const targetCount = 1500;
    const outputDir = path.resolve(__dirname);
    console.log(`Collecting up to ${targetCount} MoveInSync reviews...`);
    const data = await collectMoveInSyncReviews(targetCount);
    
    console.log('Exporting CSV & JSON...');
    exportJsonAndCsv(data, outputDir);

    console.log('Generating styled Excel (.xlsx) file...');
    await exportExcel(data, outputDir);

    console.log('\n--- COLLECTION & EXPORT COMPLETE ---');
    console.log(`Total Reviews Processed: ${data.length}`);
  } catch (err) {
    console.error('Fatal execution error:', err);
  }
}

if (require.main === module) {
  main();
}
