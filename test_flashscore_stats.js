const https = require('https');
const http = require('http');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const attempt = (redirectCount = 0) => {
      mod.get(url, { headers: HEADERS }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectCount >= 5) return reject(new Error('Too many redirects'));
          url = res.headers.location;
          if (url.startsWith('/')) {
            const u = new URL(res.req.getHeader ? 'https://www.flashscore.mobi' : url);
            url = 'https://www.flashscore.mobi' + res.headers.location;
          }
          console.log(`  Redirect -> ${url}`);
          return attempt(redirectCount + 1);
        }
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
      }).on('error', reject);
    };
    attempt();
  });
}

function extractFeed(html) {
  const patterns = [
    /window\.environment\.props\.feed\s*=\s*["']([^"']+)["']/,
    /feed\s*[:=]\s*["']([^"']+)["']/,
    /"feed"\s*:\s*"([^"]+)"/,
    /feed=([^&\s"']+)/,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) return m[1];
  }
  return null;
}

function extractMatchIds(html) {
  const ids = new Set();
  const patterns = [
    /href="\/match\/([A-Z0-9]+)\/?"/gi,
    /href="\/match\/([A-Z0-9]+)\/#/gi,
    /data-match-id="([A-Z0-9]+)"/gi,
    /\/match\/([A-Z0-9]{6,})/gi,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(html)) !== null) {
      ids.add(m[1]);
    }
  }
  return [...ids];
}

function extractJSONProps(html) {
  const m = html.match(/window\.environment\.props\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch (e) {
      console.log('  JSON parse error:', e.message);
      console.log('  Raw JSON excerpt:', m[1].substring(0, 500));
    }
  }
  
  const m2 = html.match(/window\.environment\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (m2) {
    try {
      return JSON.parse(m2[1]);
    } catch (e) {}
  }
  return null;
}

function parsePipeFeed(feed) {
  if (!feed) return null;
  const parts = feed.split('|');
  console.log(`  Feed has ${parts.length} pipe-delimited segments`);
  console.log(`  First 10 segments:`, parts.slice(0, 10));
  console.log(`  Last 5 segments:`, parts.slice(-5));
  
  
  const statsMap = {};
  let currentKey = null;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.match(/^[A-Z]{2,3}\d+$/)) {
      currentKey = p;
      statsMap[currentKey] = [];
    } else if (currentKey && p.match(/^\d/)) {
      statsMap[currentKey].push(p);
    }
  }
  return { parts, statsMap };
}

function lookForStatsInHTML(html) {
  const stats = {};
  
  const possM = html.match(/possession[^<]*?(\d+)\s*%[^<]*?(\d+)\s*%/i);
  if (possM) { stats.possession = { home: possM[1], away: possM[2] }; }
  
  const shotM = html.match(/shots?(?:\s+on\s+target)?[^<]*?(\d+)\s*[-–]\s*(\d+)/i);
  if (shotM) { stats.shots = { home: shotM[1], away: shotM[2] }; }
  
  const cornerM = html.match(/corner[^<]*?(\d+)\s*[-–]\s*(\d+)/i);
  if (cornerM) { stats.corners = { home: cornerM[1], away: cornerM[2] }; }
  
  const foulM = html.match(/foul[^<]*?(\d+)\s*[-–]\s*(\d+)/i);
  if (foulM) { stats.fouls = { home: foulM[1], away: foulM[2] }; }
  
  const xgM = html.match(/x[gG][^<]*?([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (xgM) { stats.xG = { home: xgM[1], away: xgM[2] }; }
  
  return stats;
}

async function main() {
  console.log('=== FLASHSCORE.MOBI STATS EXTRACTION TEST ===\n');

  // Step 1: Fetch the main football page
  console.log('--- Step 1: Finding finished matches ---');
  const urls = [
    'https://www.flashscore.mobi/',
    'https://www.flashscore.mobi/football/',
    'https://www.flashscore.mobi/football/?date=yesterday',
  ];

  let allMatchIds = [];
  let mainHTML = '';

  for (const url of urls) {
    console.log(`\n  Fetching: ${url}`);
    try {
      const res = await fetch(url);
      console.log(`  Status: ${res.status}`);
      console.log(`  Body length: ${res.body.length}`);
      
      if (res.body.length > 100) {
        mainHTML = res.body;
        
        // Check for match IDs
        const matchIds = extractMatchIds(res.body);
        if (matchIds.length > 0) {
          console.log(`  Found ${matchIds.length} match IDs:`, matchIds.slice(0, 10));
          allMatchIds = matchIds;
          break;
        }
        
        // Show HTML structure for debugging
        const firstPart = res.body.substring(0, 2000);
        console.log(`  HTML excerpt (first 2000 chars):\n${firstPart}\n`);
        
        // Look for score patterns indicating finished matches
        const scoreRegex = /(\d+)\s*[-:]\s*(\d+)/g;
        const scores = [];
        let sm;
        while ((sm = scoreRegex.exec(res.body)) !== null) {
          scores.push(`${sm[1]}-${sm[2]}`);
        }
        console.log(`  Found scores: ${scores.slice(0, 10).join(', ')}`);
        
        // Look for "finished" or "FT" markers
        const ftRegex = /(?:finished|FT|ft|ended|full[- ]?time|FT\*?)/gi;
        const ftMatches = [];
        let fm;
        while ((fm = ftRegex.exec(res.body)) !== null) {
          ftMatches.push(fm[0]);
        }
        console.log(`  Finish markers: ${ftMatches.slice(0, 10).join(', ')}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Step 2: If no match IDs found via regex, try known match ID patterns
  // Flashscore match IDs are typically 8-char alphanumeric
  if (allMatchIds.length === 0) {
    console.log('\n--- No match IDs found in HTML, trying alternative paths ---');
    
    // Try the mobile API endpoints
    const altUrls = [
      'https://www.flashscore.mobi/live.php',
      'https://www.flashscore.mobi/match/',
      'https://d.flashscore.mobi/x/feed/f_1_0_0_en_1',
      'https://d.flashscore.mobi/x/feed/f_1_0_1_en_1',
    ];
    
    for (const url of altUrls) {
      console.log(`\n  Trying: ${url}`);
      try {
        const res = await fetch(url);
        console.log(`  Status: ${res.status}, Length: ${res.body.length}`);
        if (res.body.length > 100) {
          console.log(`  Excerpt: ${res.body.substring(0, 500)}`);
          const ids = extractMatchIds(res.body);
          if (ids.length > 0) {
            allMatchIds = ids;
            console.log(`  Found ${ids.length} match IDs:`, ids.slice(0, 10));
            break;
          }
        }
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }
  }

  // Step 3: Try fetching specific match data
  // Use sample match IDs from recent major leagues
  const sampleMatchIds = allMatchIds.length > 0 ? allMatchIds.slice(0, 5) : [];
  
  // Also try the feed data endpoint directly
  console.log('\n--- Step 2: Testing feed endpoints ---');
  
  // Try the data feed that Flashscore uses internally
  const feedEndpoints = [
    'https://d.flashscore.mobi/x/feed/f_1_0_0_en_1',
    'https://d.flashscore.mobi/x/feed/f_1_0_1_en_1', 
    'https://d.flashscore.mobi/x/feed/f_1_0_3_en_1',
  ];
  
  for (const feedUrl of feedEndpoints) {
    console.log(`\n  Fetching feed: ${feedUrl}`);
    try {
      const customHeaders = {
        ...HEADERS,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': '*/*',
      };
      
      const res = await new Promise((resolve, reject) => {
        https.get(feedUrl, { headers: customHeaders }, (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
        }).on('error', reject);
      });
      
      console.log(`  Status: ${res.status}, Length: ${res.body.length}`);
      if (res.body.length > 0) {
        console.log(`  Content-Type: ${res.headers['content-type']}`);
        console.log(`  Excerpt: ${res.body.substring(0, 800)}`);
        
        // Extract match IDs from feed
        const feedMatchIds = extractMatchIds(res.body);
        if (feedMatchIds.length > 0) {
          allMatchIds = [...new Set([...allMatchIds, ...feedMatchIds])];
          console.log(`  Feed match IDs: ${feedMatchIds.slice(0, 10).join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Step 4: Try to access individual matches
  console.log('\n--- Step 3: Accessing individual match pages ---');
  
  // If we have match IDs, try them; otherwise try some known formats
  const matchIdsToTry = allMatchIds.length > 0 ? allMatchIds.slice(0, 5) : ['test123'];
  console.log(`  Match IDs to try: ${matchIdsToTry.join(', ')}`);

  for (const matchId of matchIdsToTry) {
    console.log(`\n  === Match: ${matchId} ===`);
    
    const matchUrls = [
      `https://www.flashscore.mobi/match/${matchId}/`,
      `https://www.flashscore.mobi/match/${matchId}/#/match-summary`,
      `https://www.flashscore.mobi/match/${matchId}/?t=stats`,
      `https://www.flashscore.mobi/match/${matchId}/#/match-summary/match-statistics/0/${matchId}`,
    ];
    
    let matchFound = false;
    
    for (const url of matchUrls) {
      console.log(`\n    Fetching: ${url}`);
      try {
        const res = await fetch(url);
        console.log(`    Status: ${res.status}, Length: ${res.body.length}`);
        
        if (res.status === 200 && res.body.length > 500) {
          const html = res.body;
          
          // Extract feed
          const feed = extractFeed(html);
          if (feed) {
            console.log(`    *** FEED FOUND! Length: ${feed.length} ***`);
            console.log(`    Feed excerpt: ${feed.substring(0, 300)}...`);
            const parsed = parsePipeFeed(feed);
            if (parsed) {
              console.log('\n    === PARSED FEED DATA ===');
              console.log(JSON.stringify(parsed, null, 2));
            }
          } else {
            console.log('    No feed found in HTML');
          }
          
          // Extract JSON props
          const props = extractJSONProps(html);
          if (props) {
            console.log(`    *** PROPS FOUND! ***`);
            console.log(`    Props keys: ${Object.keys(props).join(', ')}`);
            if (props.feed) {
              console.log(`    Props.feed length: ${props.feed.length}`);
              const parsed = parsePipeFeed(props.feed);
              if (parsed) {
                console.log('\n    === PARSED FEED FROM PROPS ===');
                console.log(JSON.stringify(parsed, null, 2));
              }
            }
          }
          
          // Look for statistics in HTML
          const htmlStats = lookForStatsInHTML(html);
          if (Object.keys(htmlStats).length > 0) {
            console.log('\n    === STATS FOUND IN HTML ===');
            console.log(JSON.stringify(htmlStats, null, 2));
          }
          
          // Look for stat-related JS variables
          const jsVarRegex = /(?:var|let|const)\s+(\w*(?:stat|xG|xg|possession|shot|corner|foul)\w*)\s*=\s*["']([^"']+)["'];?/gi;
          let jv;
          while ((jv = jsVarRegex.exec(html)) !== null) {
            console.log(`    JS var: ${jv[1]} = ${jv[2].substring(0, 200)}`);
          }
          
          // Look for data-stat attributes or stat rows
          const statRowRegex = /data-stat[^>]*>([^<]+)/gi;
          const statRows = [];
          let sr;
          while ((sr = statRowRegex.exec(html)) !== null) {
            statRows.push(sr[1].trim());
          }
          if (statRows.length > 0) {
            console.log(`    Stat rows found: ${statRows.slice(0, 20).join(' | ')}`);
          }
          
          // Check for any JSON with stats
          const jsonStatRegex = /["'](?:stats|statistics|stat)\w*["']\s*[:=]\s*(\[[\s\S]*?\]|\{[\s\S]*?\})/gi;
          let js;
          while ((js = jsonStatRegex.exec(html)) !== null) {
            try {
              const parsed = JSON.parse(js[1]);
              console.log(`    Stats JSON: ${JSON.stringify(parsed).substring(0, 500)}`);
            } catch (e) {
              console.log(`    Stats data (raw): ${js[1].substring(0, 300)}`);
            }
          }
          
          matchFound = true;
          
          // Show relevant HTML sections
          const lowerHTML = html.toLowerCase();
          const statIdx = lowerHTML.indexOf('statistic');
          if (statIdx > -1) {
            console.log(`    HTML around 'statistic' (${statIdx}):`);
            console.log(`    ...${html.substring(Math.max(0, statIdx - 100), statIdx + 300)}...`);
          }
          
          const possessionIdx = lowerHTML.indexOf('possession');
          if (possessionIdx > -1) {
            console.log(`    HTML around 'possession' (${possessionIdx}):`);
            console.log(`    ...${html.substring(Math.max(0, possessionIdx - 100), possessionIdx + 300)}...`);
          }
          
          // If we found data, don't try more URLs for this match
          if (feed || Object.keys(htmlStats).length > 0 || (props && props.feed)) {
            break;
          }
        }
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }
    }
    
    if (matchFound) {
      console.log(`\n  ✓ Match ${matchId} data accessed successfully`);
    } else {
      console.log(`\n  ✗ Could not access data for match ${matchId}`);
    }
  }
  
  // Step 5: Also try the flashscore.com desktop version feed API
  console.log('\n--- Step 4: Trying Flashscore desktop feed API ---');
  
  const desktopFeedUrls = [
    'https://d.flashscore.com/x/feed/f_1_0_0_en_1',
    'https://d.flashscore.com/x/feed/f_1_0_3_en_1',
  ];
  
  for (const url of desktopFeedUrls) {
    console.log(`\n  Fetching: ${url}`);
    try {
      const res = await new Promise((resolve, reject) => {
        https.get(url, {
          headers: {
            ...HEADERS,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*',
            'Origin': 'https://www.flashscore.com',
            'Referer': 'https://www.flashscore.com/',
          }
        }, (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
        }).on('error', reject);
      });
      
      console.log(`  Status: ${res.status}, Length: ${res.body.length}`);
      if (res.body.length > 100) {
        console.log(`  Excerpt: ${res.body.substring(0, 800)}`);
        
        const deskMatchIds = extractMatchIds(res.body);
        if (deskMatchIds.length > 0) {
          console.log(`  Desktop match IDs: ${deskMatchIds.slice(0, 10).join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Step 6: Try direct match statistics feed endpoint
  console.log('\n--- Step 5: Trying direct statistics feed ---');
  
  // Common Flashscore match ID format - try some recent-looking IDs
  // These are 8-character hex IDs
  if (allMatchIds.length > 0) {
    for (const matchId of allMatchIds.slice(0, 3)) {
      const statFeedUrls = [
        `https://d.flashscore.mobi/x/feed/d刮e${matchId}`,
        `https://d.flashscore.mobi/match/${matchId}?t=stats`,
      ];
      
      for (const url of statFeedUrls) {
        console.log(`\n  Fetching stats: ${url}`);
        try {
          const res = await fetch(url);
          console.log(`  Status: ${res.status}, Length: ${res.body.length}`);
          if (res.body.length > 100) {
            console.log(`  Excerpt: ${res.body.substring(0, 500)}`);
          }
        } catch (e) {
          console.log(`  Error: ${e.message}`);
        }
      }
    }
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`Match IDs discovered: ${allMatchIds.length > 0 ? allMatchIds.join(', ') : 'NONE'}`);
  console.log('Test complete.');
}

main().catch(e => console.error('Fatal error:', e));