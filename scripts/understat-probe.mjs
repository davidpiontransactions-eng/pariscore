(async () => {
  const r = await fetch("https://understat.com/getLeagueData/Ligue_1/2025", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
    },
  });
  const j = await r.json();
  console.log("keys:", Object.keys(j));
  const players = j.players;
  console.log("players type:", Array.isArray(players) ? `array(${players.length})` : typeof players);
  if (!Array.isArray(players)) console.log("players keys:", Object.keys(players));
  const sample = Array.isArray(players) ? players[0] : Object.values(players)[0];
  console.log("sample:", JSON.stringify(sample).slice(0, 400));
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
