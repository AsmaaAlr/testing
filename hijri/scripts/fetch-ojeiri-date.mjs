import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const URL = "https://www.alojeiri.com/en/ojeiri-calendar";

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function extractDatesFromText(text) {
  const cleaned = cleanText(text);

  // Example Gregorian pattern:
  // Saturday 20 Dec 2025
  const gregorianRegex =
    /\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+\d{1,2}\s+[A-Z][a-z]{2,}\s+\d{4}\b/;

  // Example Hijri pattern:
  // 29 Jumada Alakhirah 1447
  // 1 Ramadan 1447
  const hijriRegex =
    /\b\d{1,2}\s+[A-Za-z][A-Za-z' -]{2,}\s+\d{4}\b/g;

  const gregorianMatch = cleaned.match(gregorianRegex);
  const hijriMatches = cleaned.match(hijriRegex) || [];

  let gregorian = gregorianMatch ? gregorianMatch[0] : "";
  let hijri = "";

  // Pick a likely Hijri candidate by excluding obvious Gregorian-like matches
  for (const candidate of hijriMatches) {
    if (!/[A-Z][a-z]{2,}\s+\d{4}$/.test(candidate) || /Jumada|Muharram|Safar|Rabi|Rajab|Shaaban|Ramadan|Shawwal|Dhul|Hijjah|Thul/i.test(candidate)) {
      hijri = candidate;
      break;
    }
  }

  return { gregorian, hijri };
}

async function main() {
  const res = await fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GitHubAction/1.0)"
    }
  });

  if (!res.ok) {
    throw new Error(`Fetch failed with status ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const bodyText = cleanText($("body").text());
  let { gregorian, hijri } = extractDatesFromText(bodyText);

  // Extra fallback: scan likely calendar containers if needed
  if (!hijri) {
    const candidates = [];
    $("div, section, article, span, p, h1, h2, h3").each((_, el) => {
      const text = cleanText($(el).text());
      if (text.length > 5 && text.length < 200) {
        candidates.push(text);
      }
    });

    for (const text of candidates) {
      const found = extractDatesFromText(text);
      if (found.hijri) {
        hijri = found.hijri;
        if (!gregorian && found.gregorian) gregorian = found.gregorian;
        break;
      }
    }
  }

  if (!hijri) {
    throw new Error("Could not extract Hijri date from Alojeiri page.");
  }

  const data = {
    hijri,
    gregorian,
    source: URL,
    updated_at: new Date().toISOString()
  };

  await fs.writeFile("date.json", JSON.stringify(data, null, 2), "utf8");
  console.log("date.json updated:", data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});