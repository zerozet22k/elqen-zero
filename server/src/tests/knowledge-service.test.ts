import { describe, expect, it } from "vitest";
import {
  normalizeKnowledgeText,
  rankKnowledgeItemMatch,
} from "../services/knowledge.service";

describe("knowledgeService matching", () => {
  const priceItem = {
    title: "စျေးနှုန်းများ",
    content:
      "Stick ဈေးနှုန်းလေးက တစ်ဘာသာကို 49,000 ကျပ်ပါခင်ဗျာ။ Telegram video files လေးနဲ့လေ့လာမယ်ဆို တစ်ဘာသာကို 25,000 ကျပ်ပါခင်ဗျာ။",
    tags: [
      "price",
      "ဈေးကဘယ်လောက်လဲ",
      "ဈေးနှုန်းလေး",
      "ဘယ်လောက်လဲ",
      "How much?",
      "how much?",
    ],
  };

  const contactItem = {
    title: "NEC ဆက်သွယ်ရန် အချက်အလက်",
    content:
      "Noble Educare Centre - NEC ၏ ဆက်သွယ်ရန် ဖုန်းနံပါတ်မှာ 09 987 475 416/ 09 979 816 922 တို့ ဖြစ်ပါတယ်ခင်ဗျာ။",
    tags: [
      "contact",
      "phone",
      "address",
      "support",
      "ဖုန်းနံပါတ်",
      "လိပ်စာ",
      "ဘယ်ကိုလာရမလဲ",
    ],
  };

  const usageItem = {
    title: "NEC Video Stick အသုံးပြုပုံ",
    content:
      "Stick ကို ဖုန်းနဲ့အသုံးပြုနည်း video file လေးပို့ပေးပါမယ်ခင်ဗျာ၊ ဘယ်ဖုန်းအမျိုးအစားလေးနဲ့အသုံးပြုမှာလဲခင်ဗျာ။",
    tags: [
      "stick",
      "usb",
      "usage",
      "setup",
      "video-files",
      "အသုံးပြုပုံ",
      "ဘယ်လိုသုံးရလဲ",
      "ဖုန်းနဲ့ကြည့်လို့ရလား",
    ],
  };

  it("preserves Burmese customer text during normalization", () => {
    expect(normalizeKnowledgeText("စတစ်ကဘယ်လောက်လဲ")).not.toBe("");
    expect(normalizeKnowledgeText("စျေး")).toBe("ဈေး");
  });

  it("ranks pricing knowledge above contact info for Burmese price questions", () => {
    const query = "စတစ်ကဘယ်လောက်လဲ";

    const priceMatch = rankKnowledgeItemMatch(priceItem, query);
    const contactMatch = rankKnowledgeItemMatch(contactItem, query);

    expect(priceMatch.score).toBeGreaterThan(0.45);
    expect(priceMatch.score).toBeGreaterThan(contactMatch.score);
    expect(priceMatch.topicKey).toBe("ဘယ်လောက်လဲ");
  });

  it("prefers pricing knowledge over generic stick usage for mixed-language price questions", () => {
    const query = "Stick စျေးလေးမေးချင်လို့ပါ";

    const priceMatch = rankKnowledgeItemMatch(priceItem, query);
    const usageMatch = rankKnowledgeItemMatch(usageItem, query);

    expect(priceMatch.score).toBeGreaterThan(usageMatch.score);
    expect(priceMatch.topicKey).toBe("ဈေးနှုန်းလေး");
  });
});
