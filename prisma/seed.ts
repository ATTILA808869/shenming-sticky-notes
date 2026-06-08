import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const img = (text: string, bg = "FFE2CF") =>
  `https://placehold.co/900x900/${bg}/2E2A27/png?text=${encodeURIComponent(text)}`;

async function main() {
  const existingCategories = await prisma.category.count();
  if (existingCategories > 0) {
    console.log("Database already has content. Skipping seed.");
    return;
  }

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.post.deleteMany();
  await prisma.category.deleteMany();
  await prisma.siteContent.deleteMany();

  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: "招財開運",
        slug: "fortune",
        description: "把願望貼在桌上，讓財神爺每天幫你點名。",
        imageUrl: img("招財開運", "FFF1B8")
      }
    }),
    prisma.category.create({
      data: {
        name: "考試工作",
        slug: "study-work",
        description: "文昌帝君加班款，適合筆記、讀書、提案與靈感衝刺。",
        imageUrl: img("考試工作", "D9F4EA")
      }
    }),
    prisma.category.create({
      data: {
        name: "戀愛人緣",
        slug: "love",
        description: "月老系便利貼，曖昧、祝福、提醒回訊息都很可以。",
        imageUrl: img("戀愛人緣", "FFD7E3")
      }
    })
  ]);

  await prisma.product.createMany({
    data: [
      {
        name: "財神爺今天也想暴富便利貼",
        slug: "money-god-rich-note",
        description: "Q 版財神爺拿著金元寶，適合記帳、待辦與月底精神喊話。",
        price: 160,
        salePrice: 129,
        soldCount: 1688,
        rating: 4.9,
        tags: "熱賣,招財,辦公室人氣",
        images: [img("財神爺便利貼", "FFF1B8"), img("金元寶款", "F8D46A"), img("辦公桌情境", "FFE2CF")].join(","),
        specs: "30張,60張,90張",
        categoryId: categories[0].id
      },
      {
        name: "文昌帝君不要滑手機便利貼",
        slug: "wenchang-focus-note",
        description: "讀書與工作都需要一點神力提醒，貼上去就像被溫柔監考。",
        price: 150,
        salePrice: 119,
        soldCount: 942,
        rating: 4.8,
        tags: "考試,專注,學生最愛",
        images: [img("文昌便利貼", "D9F4EA"), img("專注符", "B8EBD9"), img("書桌情境", "FFF8ED")].join(","),
        specs: "綠色款,金榜款,整套",
        categoryId: categories[1].id
      },
      {
        name: "月老已讀不回退散便利貼",
        slug: "matchmaker-reply-note",
        description: "用可愛紅線包住提醒事項，送禮自用都帶一點甜甜幽默。",
        price: 170,
        salePrice: 139,
        soldCount: 1204,
        rating: 4.9,
        tags: "戀愛,送禮,新品",
        images: [img("月老便利貼", "FFD7E3"), img("紅線款", "FFB4C8"), img("禮物情境", "FFF8ED")].join(","),
        specs: "粉紅款,紅線款,戀愛套組",
        categoryId: categories[2].id
      },
      {
        name: "媽祖保庇出貨順順便利貼",
        slug: "mazu-shipping-note",
        description: "電商、設計師、專案人都需要的順風款，貼在包裹或電腦旁都喜氣。",
        price: 180,
        salePrice: 149,
        soldCount: 777,
        rating: 4.7,
        tags: "台味,出貨,文創",
        images: [img("媽祖便利貼", "FBD3C2"), img("保庇款", "E84235"), img("包裝情境", "FFF1B8")].join(","),
        specs: "平安款,出貨款,大份量",
        categoryId: categories[0].id
      }
    ]
  });

  await prisma.post.createMany({
    data: [
      {
        title: "為什麼辦公桌需要一位 Q 版神明？",
        slug: "why-your-desk-needs-a-cute-god",
        excerpt: "從民間信仰到日常文具，我們把祝福變成每天都用得到的小提醒。",
        content: "神明便利貼相信，信仰不一定要嚴肅到讓人不敢靠近。它也可以是桌上的一句鼓勵、待辦清單旁的可愛陪伴，或是送給朋友的一個會心一笑。我們把台灣民間信仰裡的祝福語彙，轉成更年輕、更日常的文創商品。",
        coverUrl: img("品牌故事", "FFF1B8")
      },
      {
        title: "三款開運便利貼的使用時機",
        slug: "three-lucky-notes",
        excerpt: "財神、文昌、月老怎麼選？看你的今日任務是哪一種。",
        content: "要衝業績，選財神爺；要讀書提案，選文昌帝君；要送禮、提醒朋友回訊息，月老款最剛好。每一款都不只是圖案，而是把心願變成可行動的小紙條。",
        coverUrl: img("開運使用指南", "D9F4EA")
      }
    ]
  });

  await prisma.siteContent.createMany({
    data: [
      {
        key: "home",
        title: "神明便利貼",
        subtitle: "把願望貼起來，讓 Q 版神明幫你盯進度。",
        body: "可愛、文創、台灣味。從辦公室到書桌，讓每一張便利貼都像一張小小的祝福符。",
        imageUrl: img("神明便利貼", "FFE2CF")
      },
      {
        key: "about",
        title: "關於神明便利貼",
        subtitle: "我們把民間信仰變得更親切，也更日常。",
        body: "神明便利貼是一個以台灣民間信仰為靈感的文具品牌。用 Q 版角色、幽默文案與乾淨設計，陪你記下重要任務、祝福與那些不能再拖的待辦。",
        imageUrl: img("關於我們", "FFF8ED")
      },
      {
        key: "contact",
        title: "聯絡我們",
        subtitle: "合作、客製、宮廟聯名都歡迎來信。",
        body: "Email: hello@godnotes.tw\nInstagram: @godnotes.tw\n客服時間：週一至週五 10:00-18:00",
        imageUrl: img("聯絡我們", "D9F4EA")
      }
    ]
  });

  const product = await prisma.product.findFirstOrThrow();
  await prisma.order.create({
    data: {
      customer: "王小明",
      email: "demo@example.com",
      phone: "0912345678",
      address: "台北市信義區保庇路 88 號",
      note: "請幫我放一張發財祝福小卡",
      status: "PAID",
      subtotal: 258,
      shippingFee: 60,
      total: 318,
      items: {
        create: [{ productId: product.id, name: product.name, price: product.salePrice ?? product.price, quantity: 2, spec: "60張" }]
      }
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
