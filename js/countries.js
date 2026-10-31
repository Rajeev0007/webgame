// Country candidates. All parties, slogans and mascots are fictional parodies.
(() => {
  "use strict";
  const BR = (window.BR = window.BR || {});

  const LIST =
    "AF Afghanistan|AL Albania|DZ Algeria|AD Andorra|AO Angola|AG Antigua and Barbuda|AR Argentina|AM Armenia|" +
    "AU Australia|AT Austria|AZ Azerbaijan|BS Bahamas|BH Bahrain|BD Bangladesh|BB Barbados|BY Belarus|BE Belgium|" +
    "BZ Belize|BJ Benin|BT Bhutan|BO Bolivia|BA Bosnia and Herzegovina|BW Botswana|BR Brazil|BN Brunei|BG Bulgaria|" +
    "BF Burkina Faso|BI Burundi|CV Cabo Verde|KH Cambodia|CM Cameroon|CA Canada|CF Central African Republic|TD Chad|" +
    "CL Chile|CN China|CO Colombia|KM Comoros|CG Congo|CD DR Congo|CR Costa Rica|CI Côte d'Ivoire|HR Croatia|CU Cuba|" +
    "CY Cyprus|CZ Czechia|DK Denmark|DJ Djibouti|DM Dominica|DO Dominican Republic|EC Ecuador|EG Egypt|SV El Salvador|" +
    "GQ Equatorial Guinea|ER Eritrea|EE Estonia|SZ Eswatini|ET Ethiopia|FJ Fiji|FI Finland|FR France|GA Gabon|GM Gambia|" +
    "GE Georgia|DE Germany|GH Ghana|GR Greece|GD Grenada|GT Guatemala|GN Guinea|GW Guinea-Bissau|GY Guyana|HT Haiti|" +
    "HN Honduras|HU Hungary|IS Iceland|IN India|ID Indonesia|IR Iran|IQ Iraq|IE Ireland|IL Israel|IT Italy|JM Jamaica|" +
    "JP Japan|JO Jordan|KZ Kazakhstan|KE Kenya|KI Kiribati|XK Kosovo|KW Kuwait|KG Kyrgyzstan|LA Laos|LV Latvia|" +
    "LB Lebanon|LS Lesotho|LR Liberia|LY Libya|LI Liechtenstein|LT Lithuania|LU Luxembourg|MG Madagascar|MW Malawi|" +
    "MY Malaysia|MV Maldives|ML Mali|MT Malta|MH Marshall Islands|MR Mauritania|MU Mauritius|MX Mexico|FM Micronesia|" +
    "MD Moldova|MC Monaco|MN Mongolia|ME Montenegro|MA Morocco|MZ Mozambique|MM Myanmar|NA Namibia|NR Nauru|NP Nepal|" +
    "NL Netherlands|NZ New Zealand|NI Nicaragua|NE Niger|NG Nigeria|KP North Korea|MK North Macedonia|NO Norway|OM Oman|" +
    "PK Pakistan|PW Palau|PS Palestine|PA Panama|PG Papua New Guinea|PY Paraguay|PE Peru|PH Philippines|PL Poland|" +
    "PT Portugal|QA Qatar|RO Romania|RU Russia|RW Rwanda|KN Saint Kitts and Nevis|LC Saint Lucia|" +
    "VC Saint Vincent and the Grenadines|WS Samoa|SM San Marino|ST São Tomé and Príncipe|SA Saudi Arabia|SN Senegal|" +
    "RS Serbia|SC Seychelles|SL Sierra Leone|SG Singapore|SK Slovakia|SI Slovenia|SB Solomon Islands|SO Somalia|" +
    "ZA South Africa|KR South Korea|SS South Sudan|ES Spain|LK Sri Lanka|SD Sudan|SR Suriname|SE Sweden|CH Switzerland|" +
    "SY Syria|TW Taiwan|TJ Tajikistan|TZ Tanzania|TH Thailand|TL Timor-Leste|TG Togo|TO Tonga|TT Trinidad and Tobago|" +
    "TN Tunisia|TR Türkiye|TM Turkmenistan|TV Tuvalu|UG Uganda|UA Ukraine|AE United Arab Emirates|GB United Kingdom|" +
    "US United States|UY Uruguay|UZ Uzbekistan|VU Vanuatu|VA Vatican City|VE Venezuela|VN Vietnam|YE Yemen|ZM Zambia|" +
    "ZW Zimbabwe";

  const REGIONS = {
    Europe: "AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA",
    Asia: "AF AM AZ BH BD BT BN KH CN GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
    Africa: "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW",
    "North America": "AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US",
    "South America": "AR BO BR CL CO EC GY PY PE SR UY VE",
    Oceania: "AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU",
  };
  const REGION_OF = {};
  for (const [r, codes] of Object.entries(REGIONS)) codes.split(" ").forEach(c => (REGION_OF[c] = r));

  // Speech-synthesis language per country (browser falls back to the base language, then default voice)
  const LANG = {};
  const langGroup = (lang, codes) => codes.split(" ").forEach(c => (LANG[c] = lang));
  langGroup("es-MX", "MX GT HN SV NI CR PA CU DO");
  langGroup("es-US", "BO CL CO EC PY PE UY VE AR");
  langGroup("es-ES", "ES GQ AD");
  langGroup("ar-SA", "SA AE BH KW QA OM YE IQ SY JO LB PS LY DZ MA TN MR SD EG");
  langGroup("fr-FR", "FR BJ BF BI CM CF TD KM CG CD CI DJ GA GN HT LU MC MG ML NE SN TG SC");
  langGroup("fr-BE", "BE");
  langGroup("pt-PT", "PT AO CV GW MZ ST TL");
  langGroup("pt-BR", "BR");
  langGroup("de-DE", "DE LI");
  langGroup("de-AT", "AT");
  langGroup("de-CH", "CH");
  langGroup("it-IT", "IT SM VA");
  langGroup("nl-NL", "NL SR");
  langGroup("ru-RU", "RU BY KZ KG TJ TM UZ");
  langGroup("en-GB", "GB MT CY BS BB BZ AG DM GD KN LC VC TT GY FJ KI MH FM NR PW PG WS SB TO TV VU");
  langGroup("en-US", "US LR");
  langGroup("en-AU", "AU");
  langGroup("en-NZ", "NZ");
  langGroup("en-CA", "CA");
  langGroup("en-IE", "IE");
  langGroup("en-ZA", "ZA BW NA LS SZ ZW ZM MW");
  langGroup("en-NG", "NG GH SL GM");
  langGroup("en-KE", "KE UG RW SS ET ER SO MU");
  langGroup("en-IN", "LK MV BT");
  langGroup("en-SG", "SG BN");
  langGroup("en-JM", "JM");
  langGroup("sw-TZ", "TZ");
  Object.assign(LANG, {
    IN: "hi-IN", PK: "ur-PK", BD: "bn-BD", NP: "ne-NP", JP: "ja-JP", KR: "ko-KR", KP: "ko-KR", CN: "zh-CN",
    TW: "zh-TW", TH: "th-TH", VN: "vi-VN", ID: "id-ID", MY: "ms-MY", PH: "fil-PH", KH: "km-KH", LA: "lo-LA",
    MM: "my-MM", MN: "mn-MN", TR: "tr-TR", GR: "el-GR", PL: "pl-PL", CZ: "cs-CZ", SK: "sk-SK", HU: "hu-HU",
    RO: "ro-RO", MD: "ro-RO", BG: "bg-BG", RS: "sr-RS", ME: "sr-RS", HR: "hr-HR", BA: "bs-BA", SI: "sl-SI",
    MK: "mk-MK", AL: "sq-AL", XK: "sq-AL", UA: "uk-UA", EE: "et-EE", LV: "lv-LV", LT: "lt-LT", FI: "fi-FI",
    SE: "sv-SE", NO: "nb-NO", DK: "da-DK", IS: "is-IS", IL: "he-IL", IR: "fa-IR", AF: "fa-IR", AM: "hy-AM",
    AZ: "az-AZ", GE: "ka-GE",
  });

  // Hand-written parody candidates
  const FEATURED = {
    US: { party: "Freedom Eagle Party", mascot: "🦅", bullet: "🍔", type: "tank", special: "storm", sname: "Freedom Fireworks", phrase: "Yes we rizz! Make aura great again!", pitch: 0.85, rate: 1.05 },
    GB: { party: "Tea and Queue Party", mascot: "🫖", bullet: "☕", type: "balanced", special: "freeze", sname: "The Endless Queue", phrase: "Keep calm and farm aura, innit.", pitch: 1.0, rate: 0.95 },
    IN: { party: "Chai Coalition", mascot: "🏏", bullet: "🍛", type: "gunner", special: "barrage", sname: "Cricket Sixer", phrase: "Arre bhai! Vote do, aura lo!", pitch: 1.05, rate: 1.1 },
    FR: { party: "Baguette Révolution", mascot: "🥖", bullet: "🥐", type: "glass", special: "shockwave", sname: "La Grève", phrase: "Liberté, égalité, aura!", pitch: 1.1, rate: 0.95 },
    DE: { party: "Efficiency Union", mascot: "🥨", bullet: "🌭", type: "tank", special: "freeze", sname: "Bürokratie", phrase: "Das ist sehr sigma. Ja.", pitch: 0.8, rate: 0.9 },
    IT: { party: "Pasta Populista", mascot: "🍝", bullet: "🍕", type: "balanced", special: "charm", sname: "Dolce Rizz", phrase: "Mamma mia, che aura!", pitch: 1.15, rate: 1.1 },
    JP: { party: "Kawaii Diet Party", mascot: "🍣", bullet: "🍙", type: "speedy", special: "dash", sname: "Shinkansen Dash", phrase: "Sugoi! Aura desu!", pitch: 1.35, rate: 1.1 },
    CN: { party: "Panda Prosperity Party", mascot: "🐼", bullet: "🥟", type: "balanced", special: "decoy", sname: "Panda Diplomacy", phrase: "Hen hao! Aura very good!", pitch: 1.0, rate: 1.0 },
    RU: { party: "Bear Hug Bloc", mascot: "🐻", bullet: "❄️", type: "tank", special: "shockwave", sname: "Bear Hug", phrase: "Davai davai! Maximum aura!", pitch: 0.7, rate: 0.9 },
    BR: { party: "Samba Squad", mascot: "⚽", bullet: "⚽", type: "speedy", special: "storm", sname: "Carnival Confetti", phrase: "Vai Brasil! Que aura!", pitch: 1.1, rate: 1.15 },
    MX: { party: "Taco Tuesday Party", mascot: "🌮", bullet: "🌶️", type: "gunner", special: "barrage", sname: "Piñata Party", phrase: "¡Ándale! ¡Puro aura, no cap!", pitch: 1.05, rate: 1.15 },
    CA: { party: "Maple Sorry Party", mascot: "🍁", bullet: "🥞", type: "tank", special: "charm", sname: "Sorry Not Sorry", phrase: "Sorry, but you're getting ratio'd, eh.", pitch: 1.0, rate: 0.95 },
    AU: { party: "Barbie Down Under", mascot: "🦘", bullet: "🪃", type: "speedy", special: "dash", sname: "Kangaroo Kick", phrase: "G'day! Too much aura, mate!", pitch: 0.95, rate: 1.1 },
    KR: { party: "K-Pop Stan Party", mascot: "🎶", bullet: "💜", type: "speedy", special: "charm", sname: "Fan Service", phrase: "Daebak! Aura fighting!", pitch: 1.3, rate: 1.1 },
    ES: { party: "Siesta Socialistas", mascot: "💃", bullet: "🥘", type: "balanced", special: "freeze", sname: "Siesta Time", phrase: "¡Olé! ¡Mucha aura!", pitch: 1.05, rate: 1.1 },
    EG: { party: "Pyramid Scheme Party", mascot: "🐫", bullet: "🔺", type: "tank", special: "shockwave", sname: "Pharaoh Pulse", phrase: "Yalla! Vote for the aura!", pitch: 0.9, rate: 1.0 },
    NG: { party: "Jollof Justice Party", mascot: "🍲", bullet: "🥁", type: "gunner", special: "storm", sname: "Afrobeats Drop", phrase: "Oya! Na aura we dey vote!", pitch: 1.0, rate: 1.1 },
    ZA: { party: "Braai Alliance", mascot: "🦁", bullet: "📯", type: "balanced", special: "shockwave", sname: "Vuvuzela Blast", phrase: "Eish! Lekker aura, bru!", pitch: 0.95, rate: 1.05 },
    KE: { party: "Marathon Majority", mascot: "🏃", bullet: "☕", type: "speedy", special: "dash", sname: "Marathon Sprint", phrase: "Sawa sawa! Aura ni yetu!", pitch: 1.0, rate: 1.15 },
    PK: { party: "Biryani Bloc", mascot: "🏏", bullet: "🍚", type: "glass", special: "barrage", sname: "Cricket Bouncer", phrase: "Kya baat hai! Aura zindabad!", pitch: 0.95, rate: 1.05 },
    BD: { party: "Rickshaw Rally Party", mascot: "🛺", bullet: "🐟", type: "speedy", special: "dash", sname: "Rickshaw Rush", phrase: "Ki obostha! Aura dao!", pitch: 1.1, rate: 1.1 },
    ID: { party: "Nasi Goreng Gerakan", mascot: "🦎", bullet: "🍳", type: "balanced", special: "drain", sname: "Sambal Tax", phrase: "Mantap! Aura banget!", pitch: 1.05, rate: 1.05 },
    PH: { party: "Karaoke Coalition", mascot: "🎙️", bullet: "🎵", type: "gunner", special: "charm", sname: "Karaoke Night", phrase: "Grabe! Ang aura mo, besh!", pitch: 1.2, rate: 1.1 },
    TR: { party: "Kebab Coalition", mascot: "🥙", bullet: "🧿", type: "tank", special: "drain", sname: "Kebab Tax", phrase: "Maşallah! Çok aura!", pitch: 0.9, rate: 1.0 },
    SA: { party: "Oasis Money Party", mascot: "🐪", bullet: "🛢️", type: "glass", special: "storm", sname: "Oil Money Rain", phrase: "Yalla habibi, aura!", pitch: 0.85, rate: 1.0 },
    AE: { party: "Skyscraper Party", mascot: "🏙️", bullet: "💎", type: "balanced", special: "decoy", sname: "Mirage Double", phrase: "Habibi, come to aura!", pitch: 0.95, rate: 1.0 },
    NL: { party: "Bike Lane Party", mascot: "🚲", bullet: "🌷", type: "speedy", special: "dash", sname: "Bike Lane Blitz", phrase: "Lekker! Gezellige aura!", pitch: 1.0, rate: 1.05 },
    SE: { party: "Flat-Pack Party", mascot: "🫎", bullet: "🪑", type: "balanced", special: "decoy", sname: "Flat-Pack Clone", phrase: "Lagom aura, ja!", pitch: 1.05, rate: 0.95 },
    CH: { party: "Neutral Chocolate Party", mascot: "🧀", bullet: "🍫", type: "tank", special: "freeze", sname: "Perfect Neutrality", phrase: "Ja ja. Neutral, but sigma.", pitch: 0.95, rate: 0.9 },
    IE: { party: "Lucky Clover Party", mascot: "🍀", bullet: "🥔", type: "balanced", special: "storm", sname: "Rainbow Rain", phrase: "Grand so! Loads of aura!", pitch: 1.05, rate: 1.1 },
    JM: { party: "Chill Vibes Party", mascot: "🌴", bullet: "🥥", type: "speedy", special: "charm", sname: "Irie Rizz", phrase: "Yah mon! Pure aura!", pitch: 0.95, rate: 0.9 },
    AR: { party: "Tango Party", mascot: "🧉", bullet: "🥩", type: "glass", special: "dash", sname: "Tango Twirl", phrase: "¡Che, qué aura tremenda!", pitch: 1.05, rate: 1.1 },
    GR: { party: "Philosopher Party", mascot: "🏛️", bullet: "🫒", type: "tank", special: "shockwave", sname: "Socratic Slam", phrase: "Opa! Aura is democracy!", pitch: 0.9, rate: 0.95 },
    TH: { party: "Pad Thai Party", mascot: "🐘", bullet: "🥭", type: "balanced", special: "charm", sname: "Land of Smiles", phrase: "Sawasdee! Aura mak mak!", pitch: 1.2, rate: 1.0 },
    VN: { party: "Pho Real Party", mascot: "🍜", bullet: "🥢", type: "gunner", special: "barrage", sname: "Scooter Swarm", phrase: "Pho real! Aura number one!", pitch: 1.1, rate: 1.1 },
    PL: { party: "Pierogi Party", mascot: "🥟", bullet: "🥔", type: "tank", special: "drain", sname: "Pierogi Tax", phrase: "Kurczę! Ale aura!", pitch: 0.95, rate: 1.0 },
    NZ: { party: "Kiwi Chill Party", mascot: "🥝", bullet: "🐑", type: "speedy", special: "decoy", sname: "Sheep Decoy", phrase: "Sweet as, bro! Choice aura!", pitch: 1.0, rate: 1.0 },
    PT: { party: "Pastel de Nata Party", mascot: "⛵", bullet: "🐟", type: "balanced", special: "storm", sname: "Navigator Barrage", phrase: "Fixe! Que aura!", pitch: 1.0, rate: 1.05 },
  };

  BR.ARCHETYPES = {
    balanced: { label: "Balanced",     hp: 100, speed: 3.3, dmg: 10, fireRate: 20 },
    tank:     { label: "Tank",         hp: 150, speed: 2.8, dmg: 12, fireRate: 26 },
    speedy:   { label: "Speedy",       hp: 85,  speed: 3.9, dmg: 9,  fireRate: 18 },
    glass:    { label: "Glass Cannon", hp: 75,  speed: 3.3, dmg: 16, fireRate: 22 },
    gunner:   { label: "Gunner",       hp: 95,  speed: 3.2, dmg: 7,  fireRate: 12 },
  };

  BR.SPECIALS = {
    shockwave: { name: "Shockwave",       icon: "🌊", cd: 540, desc: "Knocks back and damages every hater nearby." },
    charm:     { name: "Rizz Aura",       icon: "💕", cd: 660, desc: "Charms all enemies for 4s. They freeze and take 2x damage." },
    dash:      { name: "Sigma Dash",      icon: "💨", cd: 360, desc: "Invincible dash that wrecks everything in its path." },
    barrage:   { name: "Missile Barrage", icon: "🚀", cd: 600, desc: "Fires 16 homing missiles." },
    drain:     { name: "Fanum Tax",       icon: "🍔", cd: 500, desc: "Steals HP from every enemy on screen and heals you." },
    freeze:    { name: "Red Tape",        icon: "📜", cd: 600, desc: "Slows all enemies and their bullets by 75% for 6s." },
    storm:     { name: "Tariff Storm",    icon: "☄️", cd: 620, desc: "Calls 20 strikes from the sky onto the haters." },
    decoy:     { name: "Campaign Double", icon: "🎭", cd: 600, desc: "Drops a decoy every hater chases. Then it explodes." },
  };

  const PARTY_TEMPLATES = [
    "{N} Aura Party", "{N} Sigma Coalition", "{N} No-Cap Alliance", "{N} Rizz Union", "{N} Good Vibes Party",
    "{N} Big W Movement", "Based {N} Front", "{N} Main Character Party", "{N} Touch Grass League",
    "{N} Bussin Bloc", "{N} Glow-Up Party", "{N} Lowkey Legends", "{N} Certified Banger Party", "{N} Slay Alliance",
  ];
  const PHRASES = [
    "Vote {N}! Maximum aura, no cap!", "{N} for the W, fr fr!", "Sheesh! {N} is cooking!",
    "Touch grass and vote {N}!", "Ratio the haters! {N} forever!", "It's giving {N} energy!", "No cap, {N} runs this!",
  ];
  const MASCOTS = ["🦁", "🐯", "🦊", "🐺", "🦉", "🐢", "🐬", "🦩", "🦜", "🐝", "⭐", "🔥", "🌈", "🎺", "🥁",
    "🌶️", "🍉", "🍍", "🥥", "🐊", "🦓", "🦒", "🐆", "🦚", "🌋", "🏔️", "🌺", "🐅", "🦬", "🐉"];
  const TYPES = Object.keys(BR.ARCHETYPES);
  const SPECIAL_KEYS = Object.keys(BR.SPECIALS);

  function seeded(code) {
    let s = (code.charCodeAt(0) * 7919 + code.charCodeAt(1) * 104729) >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  BR.CHARACTERS = LIST.split("|").map(entry => {
    const code = entry.slice(0, 2);
    const name = entry.slice(3);
    const r = seeded(code);
    const pickR = arr => arr[Math.floor(r() * arr.length)];
    const f = FEATURED[code];
    const type = f ? f.type : pickR(TYPES);
    const special = f ? f.special : pickR(SPECIAL_KEYS);
    const A = BR.ARCHETYPES[type];
    const S = BR.SPECIALS[special];
    const shortName = name.length > 16 ? code : name;
    return {
      code, name,
      region: REGION_OF[code] || "World",
      featured: !!f,
      party: f ? f.party : pickR(PARTY_TEMPLATES).replace("{N}", shortName),
      mascot: f ? f.mascot : pickR(MASCOTS),
      bullet: f ? f.bullet : "💬",
      type, typeLabel: A.label,
      hp: A.hp, speed: A.speed, dmg: A.dmg, fireRate: A.fireRate,
      special, specialName: f && f.sname ? f.sname : S.name, specialIcon: S.icon, specialDesc: S.desc, cd: S.cd,
      phrase: f ? f.phrase : pickR(PHRASES).replace("{N}", name),
      lang: LANG[code] || "en-US",
      pitch: f ? f.pitch : 0.8 + r() * 0.6,
      rate: f ? f.rate : 0.92 + r() * 0.25,
      color: `hsl(${Math.floor(r() * 360)},65%,45%)`,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  BR.REGIONS = Object.keys(REGIONS);
  BR.flagUrl = code => `https://flagcdn.com/w160/${code.toLowerCase()}.png`;
})();
