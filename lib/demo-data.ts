export const demoCategories = [
  {
    id: "cat-fortune",
    name: "招財開運",
    slug: "fortune",
    description: "把願望貼在桌上，讓財神爺每天幫你點名。",
    content: "適合招財、開運與日常祝福的商品系列。",
    imageUrl: "https://placehold.co/900x600/FFF1B8/2E2A27/png?text=Fortune",
    purchaseUrl: "https://tw.shp.ee/fy2WKTyh",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01")
  },
  {
    id: "cat-study",
    name: "考試工作",
    slug: "study-work",
    description: "文昌帝君加班款，適合筆記、讀書、提案與靈感衝刺。",
    content: "適合考試、工作、讀書與專注情境的商品系列。",
    imageUrl: "https://placehold.co/900x600/D9F4EA/2E2A27/png?text=Study",
    purchaseUrl: "https://tw.shp.ee/fy2WKTyh",
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02")
  },
  {
    id: "cat-love",
    name: "戀愛人緣",
    slug: "love",
    description: "月老系便利貼，曖昧、祝福、提醒回訊息都很可以。",
    content: "適合戀愛、人緣、送禮與可愛祝福的商品系列。",
    imageUrl: "https://placehold.co/900x600/FFD7E3/2E2A27/png?text=Love",
    purchaseUrl: "https://tw.shp.ee/fy2WKTyh",
    createdAt: new Date("2026-01-03"),
    updatedAt: new Date("2026-01-03")
  }
];

export const demoProducts = [
  {
    id: "prod-money-god",
    name: "財神爺今天也想暴富便利貼",
    slug: "money-god-rich-note",
    description: "Q 版財神爺拿著金元寶，適合記帳、待辦與月底精神喊話。",
    price: 160,
    salePrice: 129,
    soldCount: 1688,
    rating: 4.9,
    tags: "熱賣,招財,辦公室人氣",
    images: "https://placehold.co/900x900/FFF1B8/2E2A27/png?text=Money+God,https://placehold.co/900x900/F8D46A/2E2A27/png?text=Gold,https://placehold.co/900x900/FFE2CF/2E2A27/png?text=Desk",
    specs: "30張,60張,90張",
    categoryId: "cat-fortune",
    category: demoCategories[0],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01")
  },
  {
    id: "prod-wenchang",
    name: "文昌帝君不要滑手機便利貼",
    slug: "wenchang-focus-note",
    description: "讀書與工作都需要一點神力提醒，貼上去就像被溫柔監考。",
    price: 150,
    salePrice: 119,
    soldCount: 942,
    rating: 4.8,
    tags: "考試,專注,學生最愛",
    images: "https://placehold.co/900x900/D9F4EA/2E2A27/png?text=Wenchang,https://placehold.co/900x900/B8EBD9/2E2A27/png?text=Focus,https://placehold.co/900x900/FFF8ED/2E2A27/png?text=Study",
    specs: "綠色款,金榜款,整套",
    categoryId: "cat-study",
    category: demoCategories[1],
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02")
  },
  {
    id: "prod-matchmaker",
    name: "月老已讀不回退散便利貼",
    slug: "matchmaker-reply-note",
    description: "用可愛紅線包住提醒事項，送禮自用都帶一點甜甜幽默。",
    price: 170,
    salePrice: 139,
    soldCount: 1204,
    rating: 4.9,
    tags: "戀愛,送禮,新品",
    images: "https://placehold.co/900x900/FFD7E3/2E2A27/png?text=Matchmaker,https://placehold.co/900x900/FFB4C8/2E2A27/png?text=Red+Line,https://placehold.co/900x900/FFF8ED/2E2A27/png?text=Gift",
    specs: "粉紅款,紅線款,戀愛套組",
    categoryId: "cat-love",
    category: demoCategories[2],
    createdAt: new Date("2026-01-03"),
    updatedAt: new Date("2026-01-03")
  },
  {
    id: "prod-mazu",
    name: "媽祖保庇出貨順順便利貼",
    slug: "mazu-shipping-note",
    description: "電商、設計師、專案人都需要的順風款，貼在包裹或電腦旁都喜氣。",
    price: 180,
    salePrice: 149,
    soldCount: 777,
    rating: 4.7,
    tags: "台味,出貨,文創",
    images: "https://placehold.co/900x900/FBD3C2/2E2A27/png?text=Mazu,https://placehold.co/900x900/E84235/FFFFFF/png?text=Blessing,https://placehold.co/900x900/FFF1B8/2E2A27/png?text=Shipping",
    specs: "平安款,出貨款,大份量",
    categoryId: "cat-fortune",
    category: demoCategories[0],
    createdAt: new Date("2026-01-04"),
    updatedAt: new Date("2026-01-04")
  }
];

export const demoPosts = [
  {
    id: "post-desk",
    title: "為什麼辦公桌需要一位 Q 版神明？",
    slug: "why-your-desk-needs-a-cute-god",
    excerpt: "從民間信仰到日常文具，我們把祝福變成每天都用得到的小提醒。",
    content:
      "神明便利貼相信，信仰不一定要嚴肅到讓人不敢靠近。它也可以是桌上的一句鼓勵、待辦清單旁的可愛陪伴，或是送給朋友的一個會心一笑。\n\n我們把台灣民間信仰裡的祝福語彙，轉成更年輕、更日常的文創商品。",
    coverUrl: "https://placehold.co/1200x675/FFF1B8/2E2A27/png?text=Brand+Story",
    published: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01")
  },
  {
    id: "post-lucky",
    title: "三款開運便利貼的使用時機",
    slug: "three-lucky-notes",
    excerpt: "財神、文昌、月老怎麼選？看你的今日任務是哪一種。",
    content:
      "要衝業績，選財神爺；要讀書提案，選文昌帝君；要送禮、提醒朋友回訊息，月老款最剛好。\n\n每一款都不只是圖案，而是把心願變成可行動的小紙條。",
    coverUrl: "https://placehold.co/1200x675/D9F4EA/2E2A27/png?text=Lucky+Guide",
    published: true,
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02")
  }
];

export const demoContents = {
  home: {
    id: "content-home",
    key: "home",
    title: "神明便利貼",
    subtitle: "把願望貼起來，讓 Q 版神明幫你盯進度。",
    body: "可愛、文創、台灣味。從辦公室到書桌，讓每一張便利貼都像一張小小的祝福符。",
    imageUrl: "https://placehold.co/900x900/FFE2CF/2E2A27/png?text=God+Notes",
    updatedAt: new Date("2026-01-01")
  },
  about: {
    id: "content-about",
    key: "about",
    title: "關於神明便利貼",
    subtitle: "我們把民間信仰變得更親切，也更日常。",
    body: "神明便利貼是一個以台灣民間信仰為靈感的文具品牌。用 Q 版角色、幽默文案與乾淨設計，陪你記下重要任務、祝福與那些不能再拖的待辦。",
    imageUrl: "https://placehold.co/900x900/FFF8ED/2E2A27/png?text=About",
    updatedAt: new Date("2026-01-01")
  },
  contact: {
    id: "content-contact",
    key: "contact",
    title: "聯絡我們",
    subtitle: "合作、客製、宮廟聯名都歡迎來信。",
    body: "Email: hello@godnotes.tw\nInstagram: @godnotes.tw\n客服時間：週一至週五 10:00-18:00",
    imageUrl: "https://placehold.co/900x900/D9F4EA/2E2A27/png?text=Contact",
    updatedAt: new Date("2026-01-01")
  }
};
