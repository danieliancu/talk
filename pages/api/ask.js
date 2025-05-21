//pages/api/ask.js

import {
  searchCourses,
  synonymLookup,
  keywordSynonyms,
} from "@/lib/search";
import { normalizeText } from "@/lib/utils/normalize";
import { buildMeta } from "@/lib/courses/buildMeta";
import { detectSortKey } from "@/lib/sortTriggers";
import { FaUser } from "react-icons/fa";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import util from "util";






// 🔄 Fallback logic: sugestii și mapări fuzzy
function handleKeywordFallback(rawInput) {
  const keywordInput = normalizeText(rawInput);
  const suggestions = [
    { match: "nebosh", reply: `NEBOSH includes multiple certifications. Did you mean "NEBOSH General" or "NEBOSH Construction"? Please specify.` },
    { match: "iosh", reply: `IOSH includes two options. Did you mean "IOSH Working Safely" or "IOSH Managing Safely"?` },
    { match: "eusr", reply: `EUSR Water Hygiene includes two options. Did you mean "Water Hygiene AM Session" or "PM Session"?` },
    { match: "hygiene", reply: `EUSR Water Hygiene includes two options. Did you mean "Water Hygiene AM Session" or "PM Session"?` },
    { match: "water", reply: `EUSR Water Hygiene includes two options. Did you mean "Water Hygiene AM Session" or "PM Session"?` },
  ];

  for (const s of suggestions) {
    if (keywordInput.includes(s.match)) return { type: "suggestion", reply: s.reply };
  }

  const fallbacks = [
    { keyword: "mental health", key: "mhfa" },
    { keyword: "environment", key: "iema-foundation" },
    { keyword: "site supervisor", key: "sssts" },
    { keyword: "site manager", key: "smsts" },
    { keyword: "temporary works coordinator", key: "twc" },
    { keyword: "temporary works supervisor", key: "tws" },
    { keyword: "site environmental", key: "seats" },
    { keyword: "health and safety awareness", key: "hsa" },
    { keyword: "water hygiene", key: "eusr-water" },
  ];

  for (const f of fallbacks) {
    if (keywordInput.includes(f.keyword)) return { type: "validKey", validKey: f.key };
  }

  return null;
}





export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, functions, function_call, type } = req.body;
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OpenAI API key" });

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        functions,
        function_call: function_call || "auto",
      }),
    });

    const data = await openaiRes.json();
    if (!openaiRes.ok) return res.status(openaiRes.status).json({ error: data.error?.message || "OpenAI API error" });

    const choice = data.choices?.[0];
    if (choice?.finish_reason !== "function_call") {
      const reply = choice?.message?.content || "Just type or say what course you're looking for?";

      // Google TTS logic
return res.status(200).json({ reply });

    }



    const args = JSON.parse(choice.message.function_call.arguments || '{}');
    let { keyword, month, location } = args;
    const typeFilter = args.type || type || null;

    const lastUserMsg = messages.at(-1)?.content.toLowerCase() || "";
    if (!keyword) {
      keyword = lastUserMsg.split(/\s+/).find(word => synonymLookup[normalizeText(word)]) || "";
    }

    const keywordInput = normalizeText(keyword);
    let validKey = synonymLookup[keywordInput];

    const secondLastMsg = messages.at(-2)?.content || "";
    const suggestionMatch = secondLastMsg.match(/Did you mean "(.*?)" \((.*?)\)/i);
    if (!validKey && lastUserMsg === "yes" && suggestionMatch) {
      validKey = suggestionMatch[2].toLowerCase();
      keyword = validKey;
    }

    if (!validKey && lastUserMsg === "no") {
      return res.status(200).json({ reply: `No problem! "Just type or say the correct course name?` });
    }

    const fallback = handleKeywordFallback(keyword);
    if (!validKey && fallback) {
      if (fallback.type === "suggestion") return res.status(200).json({ reply: fallback.reply });
      if (fallback.type === "validKey") {
        validKey = fallback.validKey;
        keyword = validKey;
      }
    }

    // 🔧 Verificare suplimentară pe baza synonymLookup
if (!validKey && keywordInput in synonymLookup) {
  validKey = synonymLookup[keywordInput];
}

    if (!validKey) {
      return res.status(200).json({
        reply: `I'm not sure which course you're referring to yet. Just type or say the exact course name or code.`,
      });
    }

    const lastKeyword = lastUserMsg
      .split(/\s+/)
      .map(w => normalizeText(w))
      .find(w => synonymLookup[w]);

    if (lastKeyword) {
      const lastResolved = synonymLookup[lastKeyword];
      if (lastResolved && lastResolved !== validKey) {
        month = null;
        location = null;
      }
    }

    const courseRes = await fetch("https://www.targetzerotraining.co.uk/wp-json/custom/v1/products");
    const allProducts = await courseRes.json();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const venues = Array.from(
      new Set(
        allProducts
          .filter(p => {
            const name = normalizeText(p.name || "");
            return [validKey, keywordSynonyms[validKey], keyword]
              .map(normalizeText)
              .some(needle => name.includes(needle) || needle.split(" ").every(w => name.includes(w)));
          })
          .map(p => {
            p._meta = buildMeta(p, today);
            return p._meta?.location;
          })
          .filter(Boolean)
      )
    );

    const months = Array.from(
      new Set(
        allProducts
          .filter(p => {
            const name = normalizeText(p.name || "");
            return [validKey, keywordSynonyms[validKey], keyword]
              .map(normalizeText)
              .some(needle => name.includes(needle) || needle.split(" ").every(w => name.includes(w)));
          })
          .map(p => {
            const match = p.start_date?.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
            return match?.[0] || null;
          })
          .filter(Boolean)
      )
    ).sort((a, b) => new Date(`01 ${a} 2024`) - new Date(`01 ${b} 2024`));

    let venuesList = "none found";
    let monthsList = "none found";
    let venueInstruction = "month or venue";

    if (venues.length === 1 && months.length === 1) {
      venuesList = `The available venue is <strong>${venues[0]}</strong>`;
      monthsList = `The available month is <strong>${months[0]}</strong>`;
      venueInstruction = "different month or venue";
    } else {
      if (venues.length > 0) {
        venuesList = `<ul style="margin: 0; padding-left: 20px; font-size: 12px;">${venues.map(v => `<li>${v}</li>`).join("")}</ul>`;
      }
      if (months.length > 0) {
        monthsList = `<ul style="margin: 0; padding-left: 20px; font-size: 12px;">${months.map(m => `<li>${m}</li>`).join("")}</ul>`;
      }
    }

    if (!month && !location) {
      return res.status(200).json({
        reply: `
Thanks! You've told me the course is ${keywordSynonyms[validKey]}.
"Just type or say which ${venueInstruction} you are interested in?
<div style="display: flex; gap: 40px; align-items: flex-start; font-size: 12px; line-height: 18px;">
  <div><strong>Venues:</strong><br>${venuesList}</div>
  <div><strong>Months:</strong><br>${monthsList}</div>
</div>
`
      });
    }

    const results = searchCourses(allProducts, validKey, month, args.require_available_spaces, location, typeFilter);
    const userQuestion = lastUserMsg;

    const sortMap = {
      cheapest: (a, b) => a._meta.price - b._meta.price,
      "lowest price": (a, b) => a._meta.price - b._meta.price,
      "most expensive": (a, b) => b._meta.price - a._meta.price,
      "highest price": (a, b) => b._meta.price - a._meta.price,
      soonest: (a, b) => a._meta.start - b._meta.start,
      earliest: (a, b) => a._meta.start - b._meta.start,
      latest: (a, b) => b._meta.start - a._meta.start,
      shortest: (a, b) => a._meta.duration_days - b._meta.duration_days,
      longest: (a, b) => b._meta.duration_days - a._meta.duration_days,
      "most spaces": (a, b) => b._meta.available_spaces - a._meta.available_spaces,
      "least spaces": (a, b) => a._meta.available_spaces - b._meta.available_spaces,
    };

    const sortKey = detectSortKey(userQuestion);
    if (sortKey && sortMap[sortKey]) {
      results.sort(sortMap[sortKey]);
    }

    const venueMonthHTML = `
      <div style="display: flex; gap: 40px; align-items: flex-start; font-size: 12px; line-height: 18px;">
        <div><strong>Venues:</strong><br>${venuesList}</div>
        <div><strong>Months:</strong><br>${monthsList}</div>
      </div>
    `;

    let intro = "";
    let body = "";

    if (results.length) {
      results.sort((a, b) => a._meta.start - b._meta.start);
      const hasRefresher = results.some(r => r._meta.type === "refresher");

      intro = `
  <div>
    Sure! I found ${results.length} ${validKey.toUpperCase()} course${results.length > 1 ? "s" : ""}.
    ${hasRefresher ? ` Note: Some of these are Refresher courses.` : ""}
    <br>Here are the details:
  </div>
`;

      body = results.map(r => `
        <div class="courseBox">
          <span class="mainCourse">${r.name} <span class="arrow">▼</span></span>
          <span class="bodyCourse">
            <ul class="courseDetails">
              <li><strong>Location:</strong> ${r._meta.location}</li>
              <li><strong>Dates:</strong> ${r.dates_list}</li>
              <li><strong>Price:</strong> £${r.price}</li>
              <li><strong>Available Spaces:</strong> ${r.available_spaces}</li>
            </ul>
          </span>
          <a href="${r.link}" class="bookButton">
            <span>👤 ${r.available_spaces}</span>
            <span>£${r.price}</span>
            <span>BOOK NOW</span>
          </a>
        </div>
      `).join("");
    } else {
      intro = `I'm sorry, I couldn't find any ${validKey.toUpperCase()} courses matching your criteria.<br>
However, here are the available venues and months you can choose from:`;
      body = venueMonthHTML;
    }

    const finalReply = `${intro}${body}`;
return res.status(200).json({ reply: finalReply });


  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
