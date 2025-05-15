// lib/synonyms.js

import { normalizeText } from "./utils/normalize";
import courseCatalog from "../data/coursesCatalog.json";

const keywordSynonyms = {};
const synonymLookup = {};

Object.entries(courseCatalog).forEach(([category, courses]) => {
  Object.entries(courses).forEach(([code, full]) => {
    keywordSynonyms[code] = full;

    const normalizedFull = normalizeText(full);
    synonymLookup[normalizeText(code)] = code;
    synonymLookup[normalizedFull] = code;

    // fuzzy fix: co-ordinator/coordinator
    synonymLookup[normalizeText(full.replace(/co-ordinator/g, "coordinator"))] = code;
    synonymLookup[normalizeText(full.replace(/coordinator/g, "co-ordinator"))] = code;

    // -------- CUSTOM FUZZY MAPS BY CODE --------
    if (code === "smsts") {
      synonymLookup[normalizeText("site management")] = "smsts";
      synonymLookup[normalizeText("site manager course")] = "smsts";
      synonymLookup[normalizeText("manager safety course")] = "smsts";
      synonymLookup[normalizeText("s m s t s")] = "smsts";
    }

    if (code === "sssts") {
      synonymLookup[normalizeText("site supervisor")] = "sssts";
      synonymLookup[normalizeText("supervisor safety")] = "sssts";
      synonymLookup[normalizeText("triple sts")] = "sssts";
      synonymLookup[normalizeText("s s s t s")] = "sssts";
    }

    if (code === "hsa") {
      synonymLookup[normalizeText("health and safety course")] = "hsa";
      synonymLookup[normalizeText("basic health and safety")] = "hsa";
      synonymLookup[normalizeText("awareness training")] = "hsa";
    }

    if (code === "twc") {
      synonymLookup[normalizeText("temporary works coordination")] = "twc";
      synonymLookup[normalizeText("t w c")] = "twc";
      synonymLookup[normalizeText("temporary coordinator")] = "twc";
    }

    if (code === "tws") {
      synonymLookup[normalizeText("temporary works supervision")] = "tws";
      synonymLookup[normalizeText("t w s")] = "tws";
      synonymLookup[normalizeText("temporary supervisor")] = "tws";
    }

    if (code === "seats") {
      synonymLookup[normalizeText("environmental awareness")] = "seats";
      synonymLookup[normalizeText("seats course")] = "seats";
      synonymLookup[normalizeText("site environmental")] = "seats";
      synonymLookup[normalizeText("seats")] = "seats";      
    }

    if (code === "iosh-working") {
      synonymLookup[normalizeText("iosh working")] = "iosh-working";
      synonymLookup[normalizeText("working safely")] = "iosh-working";
      synonymLookup[normalizeText("iosh basic")] = "iosh-working";
    }

    if (code === "iosh-managing") {
      synonymLookup[normalizeText("iosh managing")] = "iosh-managing";
      synonymLookup[normalizeText("managing safely")] = "iosh-managing";
      synonymLookup[normalizeText("iosh advanced")] = "iosh-managing";
    }

    if (code === "nebosh-general") {
      synonymLookup[normalizeText("nebosh general")] = "nebosh-general";
      synonymLookup[normalizeText("general certificate")] = "nebosh-general";
      synonymLookup[normalizeText("nebosh level 3")] = "nebosh-general";
    }

    if (code === "nebosh-construction") {
      synonymLookup[normalizeText("nebosh construction")] = "nebosh-construction";
      synonymLookup[normalizeText("construction certificate")] = "nebosh-construction";
      synonymLookup[normalizeText("nebosh site safety")] = "nebosh-construction";
    }

    if (code === "iema-foundation") {
      synonymLookup[normalizeText("environmental management")] = "iema-foundation";
      synonymLookup[normalizeText("environment course")] = "iema-foundation";
      synonymLookup[normalizeText("iema foundation")] = "iema-foundation";
    }

    if (code === "mhfa") {
      synonymLookup[normalizeText("mental health")] = "mhfa";
      synonymLookup[normalizeText("mental health first aid")] = "mhfa";
      synonymLookup[normalizeText("mental health course")] = "mhfa";
      synonymLookup[normalizeText("mental health course for june")] = "mhfa";
      synonymLookup[normalizeText("mental health training")] = "mhfa";
    }

    if (code === "eusr-water-am") {
      synonymLookup[normalizeText("water hygiene am")] = "eusr-water-am";
      synonymLookup[normalizeText("morning water training")] = "eusr-water-am";
      synonymLookup[normalizeText("water course morning")] = "eusr-water-am";
    }

    if (code === "eusr-water-pm") {
      synonymLookup[normalizeText("water hygiene pm")] = "eusr-water-pm";
      synonymLookup[normalizeText("afternoon water training")] = "eusr-water-pm";
      synonymLookup[normalizeText("water course afternoon")] = "eusr-water-pm";
    }
  });
});

export {
  keywordSynonyms,
  synonymLookup
};
