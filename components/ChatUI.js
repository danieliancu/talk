// ChatUI.js

import { useEffect, useRef, useState } from "react";
import { FiMic } from "react-icons/fi";
import { FaPaperPlane, FaPowerOff, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import styles from "../styles/Chat.module.css";
import { keywordSynonyms } from "@/lib/search";


export default function ChatUI() {
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);


const courseListHtml = Object.entries(keywordSynonyms)
  .map(([abbr, full]) => `<li><strong>${abbr.toUpperCase()}</strong>: ${full}</li>`)
  .join("");

const [messages, setMessages] = useState([
  {
    role: "system",
    content: `You are a helpful assistant for Target Zero Training.
    You always respond based on data available via the searchCourses function, which returns courses, locations, prices, dates and availability.
    If the user mentions a new course name, even briefly (e.g. "twc course" or just "sssts"), use the function to check the details.    
    Today's date is ${new Date().toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })}. Always use the function if the user requests something specific.`,
  },
  {
    role: "assistant",
    content: `Hello! I can help you to book one of the following courses:<ul class="listCourses">${courseListHtml}</ul>`,
  }
]);



  const [recognition, setRecognition] = useState(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  useEffect(() => {
  const handler = (e) => {
    const target = e.target.closest(".mainCourse");
    if (target) {
      const courseBox = target.closest(".courseBox");
      const body = courseBox?.querySelector(".bodyCourse");
      const arrow = target.querySelector(".arrow");

      if (body && arrow) {
        const isOpen = target.classList.contains("open");
        target.classList.toggle("open", !isOpen);
        body.style.display = isOpen ? "none" : "block";
        arrow.textContent = isOpen ? "▼" : "▲";
      }
    }
  };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
  messages.forEach((msg) => {
    if (msg.role !== "system") {
      appendMessage(msg.content, msg.role === "user");
    }
  });
}, []);


  const scrollToBottom = () => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  };

  const appendMessage = (text, isUser) => {
    const wrapper = document.createElement("div");
    wrapper.className = `${styles.bubbleWrap} ${isUser ? styles.user : styles.bot}`;
    const bubble = document.createElement("div");
    bubble.className = styles.bubble;

    if (/<[a-z][\s\S]*>/i.test(text)) {
      bubble.innerHTML = text;
    } else {
      bubble.textContent = text;
    }


    wrapper.appendChild(bubble);
    chatRef.current.appendChild(wrapper);
    scrollToBottom();
  };

const speak = (text) => {
  if (isMuted) return; // NU vorbi dacă e mut

  if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
};


const sendMessage = async () => {
  const value = input.trim();
  if (!value) return;

  appendMessage(value, true);

  const allMsgs = [...messages, { role: "user", content: value }];
  setMessages(allMsgs); // păstrează tot în UI

  // trimite doar sistem + ultimele 6 mesaje reale
  const systemMessage = allMsgs[0];
  // const recent = allMsgs.slice(1).slice(-6);
  // const payload = [systemMessage, ...recent];
  const payload = allMsgs;

  setInput("");
  await sendToAPI(value, payload);
};


const sendToAPI = async (text, msgList) => {
  try {
    let detectedType = null;
    const lcText = text.toLowerCase();

    if (lcText.includes("only refresher") || lcText.includes("just refresher") || lcText.includes("refresher courses")) {
      detectedType = "refresher";
    } else if (lcText.includes("not refresher") || lcText.includes("without refresher") || lcText.includes("no refresher")) {
      detectedType = "standard";
    }

    const bodyData = {
      messages: msgList,
      functions: [
        {
          name: "searchCourses",
          description: "Finds Target Zero Training courses using title keywords and optional filters like month or availability. Also supports comparing prices, dates, durations, and available spaces.",
          parameters: {
            type: "object",
            properties: {
              keyword: { type: "string", description: "Search keyword like SMSTS, HSA, etc." },
              month: { type: "string", description: "Optional. Filter by course start month (e.g. July)" },
              location: { type: "string", description: "Optional. Filter by city or training location (e.g. Chelmsford)" },
              require_available_spaces: { type: "boolean", description: "Optional. If true, returns only courses with available seats." },
              type: {
                type: "string",
                enum: ["standard", "refresher"],
                description: "Optional. Filter by course type"
              },
              price: {
                type: "number",
                description: "Optional. Used to compare or filter by price"
              },
              start_date: {
                type: "string",
                format: "date",
                description: "Optional. Used to compare or filter by course start date"
              },
              end_date: {
                type: "string",
                format: "date",
                description: "Optional. Used to compare or filter by course end date"
              },
              available_spaces: {
                type: "integer",
                description: "Optional. Used to compare or filter by number of spaces left"
              }
            },
            required: ["keyword"]
          }
        }
      ],
      function_call: "auto"
    };

    if (detectedType) {
      bodyData.type = detectedType;
    }

    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData)
    });

    const data = await response.json();
    const fullReply = data.reply || "No reply from assistant.";

    // ✅ Afișează răspunsul direct în UI
    appendMessage(fullReply, false);
    setMessages(prev => [...prev, { role: "assistant", content: fullReply }]);

    // 🔊 Text-to-speech doar pentru introducere
let spokenIntro = "";

// Elimină HTML și normalizează
const plainText = fullReply.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Taie până la detalii cursuri / liste
const stopPhrases = [
  "Here are the details",
  "Venues:",
  "Months:",
  "The available venue is",
  "The available month is"
];

let cutAt = plainText.length;
for (const phrase of stopPhrases) {
  const idx = plainText.indexOf(phrase);
  if (idx !== -1 && idx < cutAt) cutAt = idx;
}
spokenIntro = plainText.slice(0, cutAt).trim();







const utterance = new SpeechSynthesisUtterance(spokenIntro);
utterance.lang = "en-US";

if (!isMuted) {
  if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}



  } catch (err) {
    console.error("Error:", err);
    appendMessage("Network error. Please try again later.", false);
  }
};



  const startVoice = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Browser does not support voice input");
      return;
    }

    // 🛑 Oprește orice vorbire activă înainte de a porni recunoașterea vocală
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();

    const rec = new webkitSpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      appendMessage(transcript, true);
      const updatedMessages = [...messages, { role: "user", content: transcript }];
      setMessages(updatedMessages);
      sendToAPI(transcript, updatedMessages);
      setShowVoiceModal(false);
    };

    rec.onerror = () => setShowVoiceModal(false);
    rec.onend = () => setShowVoiceModal(false);

    setRecognition(rec);
    setShowVoiceModal(true);
    rec.start();
  };

  const stopVoice = () => {
    if (recognition) recognition.stop();
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    setShowVoiceModal(false);
  };

  return (
    <div className={styles.container}>
      <audio id="tts-audio" preload="auto" />
      <div ref={chatRef} className={styles.chat}></div>
      <div className={styles.voiceWrap}>
<button
  className={styles.voiceMute}
  onClick={() => {
    setIsMuted((prev) => {
      const newValue = !prev;
      localStorage.setItem("isMuted", newValue); // optional, dacă vrei să salvezi
      if (newValue) {
        window.speechSynthesis.cancel(); // 🛑 oprește orice speech imediat
      }
      return newValue;
    });
  }}
>
  {isMuted ? (
    <FaVolumeMute style={{ color: "red" }} size={34} />
  ) : (
    <FaVolumeUp size={34} color="#19307F" />
  )}
</button>


      <button className={styles.voice} onClick={startVoice}><FiMic size={34} color="#19307F" /></button>
      <button className={styles.voiceClose} onClick={()=>window.location.reload()}><FaPowerOff size={34} color="white" /></button>
      </div>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about courses..."
        />
        <button className={styles.sendButton} onClick={sendMessage}>
          <FaPaperPlane size={20} color="white" />
        </button>
      </div>

      {showVoiceModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>Speak now!</div>
        </div>
      )}
    </div>
  );
}
