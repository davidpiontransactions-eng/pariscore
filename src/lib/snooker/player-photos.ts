// ─── Service photos joueurs Snooker via Wikipedia Commons + WST CDN ──────
// API gratuite, pas de clé, CC-BY-SA / domaine public
// Fallback: undefined → PlayerAvatar affiche les initiales

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

// Mapping CueTracker ID → URL directe photo (WST CDN ou Wikimedia Commons)
// Utilisé quand le titre Wikipedia ne fonctionne pas ou n'existe pas
const DIRECT_PHOTO_URLS: Record<string, string> = {
  // Wikimedia Commons (CC BY-SA)
  "reanne-evans": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Reanne_Evans_PHC_2017-1.jpg/200px-Reanne_Evans_PHC_2017-1.jpg",
  "oliver-brown": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Oliver_Brown_PHC_2018.jpg/200px-Oliver_Brown_PHC_2018.jpg",
  "hammad-miah": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Hammad_Miah_2025.jpg/200px-Hammad_Miah_2025.jpg",
  "ross-muir": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Ross_Muir_PHC_2016-1.jpg/200px-Ross_Muir_PHC_2016-1.jpg",
  "andrew-higginson": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Andrew_Higginson_at_Snooker_German_Masters_%28DerHexer%29_2013-01-30_04.jpg/200px-Andrew_Higginson_at_Snooker_German_Masters_%28DerHexer%29_2013-01-30_04.jpg",
  "alfie-burden": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Alfie_Burden_PHC_2016.jpg/200px-Alfie_Burden_PHC_2016.jpg",
  "antoni-kowalski": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Anton_Kazakov_Sheffield_2026.jpg/200px-Anton_Kazakov_Sheffield_2026.jpg",
  "jimmy-white": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Jimmy_White_PHC_2016-4.JPG/200px-Jimmy_White_PHC_2016-4.JPG",
  // Photos Wikipedia directes (évite rate limit API)
  "mark-williams": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Mark_Williams_at_Snooker_German_Masters_%28Martin_Rulsch%29_2014-01-30_05_%28cropped%29.jpg/200px-Mark_Williams_at_Snooker_German_Masters_%28Martin_Rulsch%29_2014-01-30_05_%28cropped%29.jpg",
  "marco-fu": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Marco_Fu_at_Snooker_German_Masters_%28Martin_Rulsch%29_2014-01-29_01.jpg/200px-Marco_Fu_at_Snooker_German_Masters_%28Martin_Rulsch%29_2014-01-29_01.jpg",
  "stuart-carrington": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Stuart_Carrington_PHC_2016-1.jpg/200px-Stuart_Carrington_PHC_2016-1.jpg",
  // WST CDN (headshots officiels)
  "mateusz-baranowski": "https://images.gc.wstservices.co.uk/fit-in/400x600/1ca16fb0-6fe2-11f1-a724-8b5354163df3.png",
  "chenzhi-gong": "https://images.gc.wstservices.co.uk/fit-in/400x600/7b816230-588b-11ef-a176-bf24d2006d98.png",
  "liu-yang": "https://images.gc.wstservices.co.uk/fit-in/400x600/1cd68970-6fe2-11f1-9a07-21b596e7208f.png",
  "luo-zetao": "https://images.gc.wstservices.co.uk/fit-in/400x600/1cafc790-6fe2-11f1-a0e6-3d8d1cf6cccd.png",
};

// Mapping CueTracker ID → titre page Wikipedia (underscores)
const PLAYER_WIKI_TITLES: Record<string, string> = {
  "judd-trump": "Judd_Trump",
  "neil-robertson": "Neil_Robertson",
  "zhao-xintong": "Zhao_Xintong",
  "wu-yize": "Wu_Yize",
  "john-higgins": "John_Higgins",
  "shaun-murphy": "Shaun_Murphy",
  "mark-williams": "Mark_Williams_(snooker_player)",
  "kyren-wilson": "Kyren_Wilson",
  "mark-selby": "Mark_Selby",
  "barry-hawkins": "Barry_Hawkins",
  "xiao-guodong": "Xiao_Guodong",
  "mark-allen": "Mark_Allen_(snooker_player)",
  "ding-junhui": "Ding_Junhui",
  "jack-lisowski": "Jack_Lisowski",
  "ronnie-osullivan": "Ronnie_O%27Sullivan",
  "ali-carter": "Ali_Carter",
  "stuart-bingham": "Stuart_Bingham",
  "stephen-maguire": "Stephen_Maguire",
  "zhou-yuelong": "Zhou_Yuelong",
  "jackson-page": "Jackson_Page",
  "noppon-saengkham": "Noppon_Saengkham",
  "pang-junxu": "Pang_Junxu",
  "liu-haotian": "Liu_Haotian_(snooker_player)",
  "scott-donaldson": "Scott_Donaldson",
  "jamie-jones": "Jamie_Jones_(snooker_player)",
  "tom-ford": "Tom_Ford_(snooker_player)",
  "gary-wilson": "Gary_Wilson_(snooker_player)",
  "yuan-sijun": "Yuan_Sijun",
  "dominic-dale": "Dominic_Dale",
  "graeme-dott": "Graeme_Dott",
  "michael-holt": "Michael_Holt_(snooker_player)",
  "liang-wenbo": "Liang_Wenbo",
  "martin-gould": "Martin_Gould",
  "david-gilbert": "David_Gilbert_(snooker_player)",
  "lu-ning": "Lu_Ning_(snooker_player)",
  "li-hang": "Li_Hang",
  "tian-pengfei": "Tian_Pengfei",
  "joe-perry": "Joe_Perry_(snooker_player)",
  "xu-si": "Xu_Si",
  "rob-milkins": "Rob_Milkins",
  "thepchaiya-un-nooh": "Thepchaiya_Un-Nooh",
  "hussain-vafaei": "Hossein_Vafaei",
  "liam-highfield": "Liam_Highfield",
  "chris-wakelin": "Chris_Wakelin",
  "billy-joe-castle": "Billy_Castle",
  "sanderson-lam": "Sanderson_Lam",
  "ben-woolaston": "Ben_Woolaston",
  "elliott-slessor": "Elliott_Slessor",
  "ashley-carty": "Ashley_Carty",
  "ian-burns": "Ian_Burns_(snooker_player)",
  "jimmy-white": "Jimmy_White",
  "alfie-burden": "Alfie_Burden",
  "andrew-higginson": "Andrew_Higginson",
  "jimmy-robertson": "Jimmy_Robertson",
  "hammad-miah": "Hammad_Miah",
  "zak-surety": "Zak_Surety",
  "long-zehuang": "Long_Zehuang",
  "antoni-kowalski": "Antoni_Kowalski",
  "rod-lawler": "Rod_Lawler",
  "daniel-wells": "Daniel_Wells",
  "simon-lichtenberg": "Simon_Lichtenberg",
  "reanne-evans": "Reanne_Evans",
  "sohail-vahedi": "Sohail_Vahedi",
  "kacper-filipiak": "Kacper_Filipiak",
  "florian-nussle": "Florian_Nüßle",
  "michael-white": "Michael_White_(snooker_player)",
  "alexander-ursenbacher": "Alexander_Ursenbacher",
  "oliver-brown": "Oliver_Brown_(snooker_player)",
  "nutcharut-wongharuthai": "Nutcharut_Wongharuthai",
  "haydon-pinhey": "Haydon_Pinhey",
  "stuart-carrington": "Stuart_Carrington",
  "martin-odonnell": "Martin_O%27Donnell",
  "jenson-kendrick": "Jenson_Kendrick",
  "luke-pinches": "Luke_Pinches",
  "mohamed-ibrahim": "Mohamed_Ibrahim_(snooker_player)",
  "declan-lavery": "Declan_Lavery",
  "manon-melief": "Manon_Melief",
  "ng-on-yee": "Ng_On_Yee",
  "lee-walker": "Lee_Walker_(snooker_player)",
  "david-lilley": "David_Lilley_(snooker_player)",
  "paul-deaville": "Paul_Deaville",
  "chatchapong-nasa": "Chatchapong_Nasa",
  "mohamed-elsayed": "Mohamed_Elsayed_(snooker_player)",
  // NIO Oddsportal players
  "mateusz-baranowski": "Mateusz_Baranowski",
  "chenzhi-gong": "Gong_Chenzhi",
  "connor-benzey": "Connor_Benzey",
  "liu-yang": "Liu_Yang_(snooker_player)",
  "jiahao-huang": "Huang_Jiahao",
  "liam-graham": "Liam_Graham",
  "iulian-boiko": "Iulian_Boiko",
  "luo-zetao": "Luo_Zetao",
  "liam-james-davies": "Liam_James_Davies",
  "fergal-quinn": "Fergal_Quinn",
  "james-connolly": "James_Connolly",
  "zhang-hanyang": "Zhang_Hanyang",
  "mohamed-elhareedy": "Mohamed_Elhareedy",
  "xu-yi-chen": "Xu_Yichen",
  "mina-awad": "Mina_Awad",
};

// Cache LRU en mémoire (1h TTL, 100 entrées)
const CACHE_TTL = 3600_000;
const CACHE_MAX = 100;
const photoCache = new Map<string, { url: string; ts: number }>();

function cleanPhotoUrl(raw: string): string {
  // Wikipedia thumb → version 200px stable
  return raw.replace(/\/(\d+)px-/, "/200px-").split("?")[0];
}

export async function fetchPlayerPhoto(cueId: string): Promise<string | undefined> {
  // 1) URL directe (WST CDN / Wikimedia Commons connus)
  const direct = DIRECT_PHOTO_URLS[cueId];
  if (direct) return direct;

  // 2) Wikipedia API
  const wikiTitle = PLAYER_WIKI_TITLES[cueId];
  if (!wikiTitle) return undefined;
  const cached = photoCache.get(wikiTitle);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.url;
  try {
    const url = `${WIKIPEDIA_API}?action=query&titles=${wikiTitle}&prop=pageimages&format=json&pithumbsize=200&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = await res.json() as any;
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    const thumbUrl = page?.thumbnail?.source;
    if (thumbUrl) {
      const clean = cleanPhotoUrl(thumbUrl);
      if (photoCache.size >= CACHE_MAX) { const k = photoCache.keys().next().value; if (k) photoCache.delete(k); }
      photoCache.set(wikiTitle, { url: clean, ts: Date.now() });
      return clean;
    }
    return undefined;
  } catch { return undefined; }
}