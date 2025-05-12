// pages/api/ask.js

import {
  searchCourses,
  extractLocation,
  synonymLookup,
  keywordSynonyms
} from "@/lib/search";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, functions, function_call, type } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OpenAI API key in environment." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "OpenAI API error" });
    }

    const choice = data.choices?.[0];
    if (choice?.finish_reason === "function_call") {
      const args = JSON.parse(choice.message.function_call.arguments || '{}');
      let { keyword, month, location } = args;
      const typeFilter = args.type || type || null;

      // ✅ fallback dacă keyword lipsește → extragem din ultimul mesaj
      const lastUserMsg = messages.at(-1)?.content.toLowerCase() || "";
      if (!keyword && lastUserMsg) {
        const words = lastUserMsg.split(/\s+/);
        for (const word of words) {
          const norm = word.toLowerCase().replace(/[^\w\s]/g, "").trim();
          if (synonymLookup[norm]) {
            keyword = norm;
            break;
          }
        }
      }

      const keywordInput = keyword?.toLowerCase().replace(/[^\w\s]/g, "").trim();
      let validKey = synonymLookup[keywordInput];

      const secondLastMsg = messages.at(-2)?.content || "";
      const suggestionMatch = secondLastMsg.match(/Did you mean "(.*?)" \((.*?)\)/i);

      if (!validKey && lastUserMsg === "yes" && suggestionMatch) {
        validKey = suggestionMatch[2].toLowerCase();
        keyword = validKey;
      }

      if (!validKey && lastUserMsg === "no" && suggestionMatch) {
        return res.status(200).json({
          reply: `No problem! Could you please tell me the correct course name you're looking for?`
        });
      }

      if (!validKey && keywordInput === "nebosh") {
        return res.status(200).json({
          reply: `NEBOSH includes multiple certifications. Did you mean "NEBOSH General" or "NEBOSH Construction"? Please specify.`
        });
      }

      if (!validKey && keywordInput === "iosh") {
        return res.status(200).json({
          reply: `IOSH includes two options. Did you mean "IOSH Working Safely" or "IOSH Managing Safely"?`
        });
      }


      if (!validKey) {
        const partialMatch = Object.entries(keywordSynonyms).find(
          ([abbr, full]) =>
            keywordInput && (abbr.includes(keywordInput) || full.toLowerCase().includes(keywordInput))
        );

        if (partialMatch) {
          const [abbr, full] = partialMatch;
          return res.status(200).json({
            reply: `Did you mean "${full}" (${abbr.toUpperCase()})? Please confirm by the course code or saying "yes".`
          });
        }

        return res.status(200).json({
          reply: `I couldn't identify a valid course type. Please specify one of the following: ${Object.keys(keywordSynonyms).join(", ").toUpperCase()}`
        });
      }

      const params = [month, location].filter(Boolean);
      if (params.length < 1) {
        return res.status(200).json({
          reply: `Thanks! You've told me the course type. Could you also provide the month or location so I can show you relevant courses?`
        });
      }

      const courseRes = await fetch("https://www.targetzerotraining.co.uk/wp-json/custom/v1/products");
      const allProducts = await courseRes.json();

      const results = searchCourses(
        allProducts,
        validKey,
        month,
        args.require_available_spaces,
        location,
        typeFilter
      );

      const userQuestion = messages.at(-1)?.content.toLowerCase() || "";

      if (userQuestion.includes("cheapest") || userQuestion.includes("lowest price")) {
        results.sort((a, b) => a._meta.price - b._meta.price);
      } else if (userQuestion.includes("most expensive") || userQuestion.includes("highest price")) {
        results.sort((a, b) => b._meta.price - a._meta.price);
      } else if (userQuestion.includes("soonest") || userQuestion.includes("earliest")) {
        results.sort((a, b) => a._meta.start - b._meta.start);
      } else if (userQuestion.includes("latest")) {
        results.sort((a, b) => b._meta.start - a._meta.start);
      } else if (userQuestion.includes("shortest")) {
        results.sort((a, b) => a._meta.duration_days - b._meta.duration_days);
      } else if (userQuestion.includes("longest")) {
        results.sort((a, b) => b._meta.duration_days - a._meta.duration_days);
      } else if (userQuestion.includes("most spaces")) {
        results.sort((a, b) => b._meta.available_spaces - a._meta.available_spaces);
      } else if (userQuestion.includes("least spaces")) {
        results.sort((a, b) => a._meta.available_spaces - b._meta.available_spaces);
      }

      let intro = "";
      if (results.length > 0) {
        const hasRefresher = results.some(r => r._meta.type === "refresher");
        intro = `Sure! I found ${results.length} ${validKey.toUpperCase()} course${results.length > 1 ? "s" : ""}.`;
        if (hasRefresher) {
          intro += `\n⚠️ Note: Some of these are Refresher courses.`;
        }
        intro += ` Here are the details:`;
      } else {
        intro = `I'm sorry, I couldn't find any ${validKey.toUpperCase()} courses matching your criteria.`;
      }

const reply = `${intro}` + results.map(r => `
  <div class="courseBox">
    <span class="mainCourse">
      ${r.name} <span class="arrow">▼</span>
    </span>
    <span class="bodyCourse">
      <ul class="courseDetails">
        <li><strong>Location:</strong> ${r._meta.location}</li>
        <li><strong>Dates:</strong> ${r.dates_list}</li>
        <li><strong>Price:</strong> £${r.price}</li>
        <li><strong>Available Spaces:</strong> ${r.available_spaces}</li>
      </ul>
    </span>
    <a href="${r.link}" class="bookButton">BOOK NOW!</a>
  </div>
`).join("");


      return res.status(200).json({ reply });
    }

    let reply = "No reply from assistant.";

    if (choice?.finish_reason === "stop" && choice?.message?.content) {
      reply = choice.message.content;
    } else if (choice?.finish_reason === "stop" && !choice.message?.content) {
      reply = "Could you please clarify what course you're looking for?";
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
