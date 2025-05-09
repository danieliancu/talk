// pages/api/ask.js

const keywordSynonyms = {
    smsts: "Site Management Safety Training Scheme",
    sssts: "Site Supervisor Safety Training Scheme",
    twc: "Temporary Works Coordinator",
    tws: "Temporary Works Supervisor",
    hsa: "Health and Safety Awareness",
    nebosh: "NEBOSH National General Certificate in Occupational Health and Safety"
  };
  
  function extractLocation(name) {
    const parts = name.split("|");
    return parts.length >= 2 ? parts[1].trim() : "Unknown";
  }
  
  function isFutureDate(startDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight
    const parsed = new Date(startDateStr);
    return !isNaN(parsed) && parsed >= today;
  }
  
  function searchCourses(allProducts, keyword = '', month = null, require_available_spaces = false, location = null) {
    const keywordInput = keyword.toLowerCase().trim();
    // const resolvedKeyword = (keywordSynonyms[keywordInput] || keyword).toLowerCase();

    let resolvedKeyword = keywordInput;
    for (const key in keywordSynonyms) {
      if (keywordInput.includes(key)) {
        resolvedKeyword = keywordInput.replace(key, keywordSynonyms[key]);
        break;
      }
    }
    resolvedKeyword = resolvedKeyword.toLowerCase();    
  
    const monthLower = month?.toLowerCase().trim() || null;
    const locationLower = location?.toLowerCase().trim() || null;
  
    return allProducts.filter(product => {
      const name = product.name?.toLowerCase() || '';
      const startDateStr = product.start_date || '';
  
      // Caută toate cuvintele din resolvedKeyword în titlu
      const matchesKeyword = resolvedKeyword.split(" ").every(word => name.includes(word));
      if (!matchesKeyword) return false;
  
      if (require_available_spaces && (!product.available_spaces || parseInt(product.available_spaces) <= 0)) {
        return false;
      }
  
      if (monthLower && startDateStr) {
        const match = startDateStr.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
        if (!match || match[1].toLowerCase() !== monthLower) return false;
      }
  
      if (locationLower && !name.includes(locationLower)) {
        return false;
      }
  
      return true;
    });
  }
  
  
  export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
  
    const { messages, functions, function_call } = req.body;
  
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
        const { keyword, month, location } = args;
        const params = [keyword, month, location].filter(Boolean);
  
        if (params.length < 2) {
          let knownParam = keyword ? `the course type \"${keyword}\"` : month ? `the month \"${month}\"` : location ? `the location \"${location}\"` : null;
          const followup = knownParam
            ? `Thanks! You've told me ${knownParam}. Could you also provide one more detail, like the month or location, so I can show you relevant courses?`
            : `To help you better, could you please let me know the course type, month, or location?`;
          return res.status(200).json({ reply: followup });
        }
  
        const resolvedKeyword = keywordSynonyms[keyword?.toLowerCase()] || keyword;
        const courseRes = await fetch("https://www.targetzerotraining.co.uk/wp-json/custom/v1/products");
        const allProducts = await courseRes.json();
  
        const results = searchCourses(allProducts, resolvedKeyword, month, args.require_available_spaces, location);
  
        let intro = "";
  
        if (results.length > 0) {
          intro = `Sure! I found ${results.length} ${resolvedKeyword} course${results.length > 1 ? 's' : ''}. Here are the details:`;
        } else {
          intro = `I'm sorry, I couldn't find any ${resolvedKeyword} courses matching your criteria.`;
        }
  
        const reply = `${intro}` + results.map(r => `
          <div class="courseBox">
            <span class="mainCourse">
              ${r.name} <span class="arrow">▼</span>
            </span>
            <span class="bodyCourse">
              📍 Location: ${extractLocation(r.name)}<br>
              📅 Dates: ${r.dates_list}<br>
              💷 Price: £${r.price}<br>
              🪑 Available Spaces: ${r.available_spaces}
            </span>
            <a href="${r.link}" class="bookButton">BOOK NOW!</a>
          </div>
        `).join("");
  
        return res.status(200).json({ reply });
      }
  
      const reply = choice?.message?.content || "No reply.";
      return res.status(200).json({ reply });
    } catch (error) {
      console.error("API error:", error);
      return res.status(500).json({ error: "Internal server error." });
    }
  }
  