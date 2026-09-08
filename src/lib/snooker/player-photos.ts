// ─── Service photos joueurs Snooker via Wikipedia Commons ─────────────────
// API gratuite, pas de clé, CC-BY-SA / domaine public
// Fallback: undefined → PlayerAvatar affiche les initiales

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

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