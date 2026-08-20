const s = require('sharp');
(async () => {
  const { data, info } = await s('.context/visual-audit-2026-08-20/home-mobile.png').raw().toBuffer({ resolveWithObject: true });
  let green = 0, total = info.width * info.height;
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i], G = data[i + 1], B = data[i + 2];
    if (G > 120 && G > R * 1.5 && G > B * 1.5) green++;
  }
  console.log('green px:', green, '(' + (green / total * 100).toFixed(2) + '%)');
})();