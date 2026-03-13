import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const URL = "https://www.alojeiri.com/en/ojeiri-calendar";

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function extractMainDates(text) {
  const cleaned = cleanText(text);

  const gregorianRegex =
    /\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\s+\d{1,2}\s+[A-Z][a-z]{2,}\s+\d{4}\b|\b(?:Saturday)\s+\d{1,2}\s+[A-Z][a-z]{2,}\s+\d{4}\b/;

  const hijriRegex =
    /\b\d{1,2}\s+(?:Muharram|Safar|Rabi(?:'|’)?\s*Al[- ]?Awwal|Rabi(?:'|’)?\s*Al[- ]?Thani|Jumada(?:h)?\s*Al[- ]?Awwal|Jumada(?:h)?\s*Al[- ]?Akhirah|Jumada\s+Alakhirah|Rajab|Shaaban|Shaban|Ramadan|Shawwal|Dhul[- ]?Qadah|Dhul[- ]?Hijjah)\s+\d{4}\b/i;

  const gregorianMatch = cleaned.match(gregorianRegex);
  const hijriMatch = cleaned.match(hijriRegex);

  return {
    gregorian: gregorianMatch ? gregorianMatch[0] : "",
    hijri: hijriMatch ? hijriMatch[0] : ""
  };
}

function extractPrayerTimesFromText(text) {
  const cleaned = cleanText(text);

  const prayers = [
    ["fajr", "Fajr"],
    ["sunrise", "Sunrise"],
    ["dhuhr", "Dhur|Dhuhr"],
    ["asr", "Asr"],
    ["maghrib", "Magrib|Maghrib"],
    ["isha", "Isha"]
  ];

  const result = {};

  for (const [key, label] of prayers) {
    const regex = new RegExp(`(?:${label})\\s*(\\d{1,2}:\\d{2}\\s?(?:AM|PM))`, "i");
    const match = cleaned.match(regex);
    result[key] = match ? match[1].toUpperCase() : "";
  }

  return result;
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

  const { gregorian, hijri } = extractMainDates(bodyText);
  const prayer_times = extractPrayerTimesFromText(bodyText);

  if (!hijri) {
    throw new Error("Could not extract Hijri date from Alojeiri page.");
  }

  const data = {
    hijri,
    gregorian,
    prayer_times,
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
