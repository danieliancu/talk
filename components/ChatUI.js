// ChatUI.js

import { useEffect, useRef, useState } from "react";
import { FiMic } from "react-icons/fi";
import { FaPaperPlane } from "react-icons/fa";
import styles from "../styles/Chat.module.css";


export default function ChatUI() {
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState("");
const [messages, setMessages] = useState([
  {
    role: "system",
    content:
      `You are a helpful assistant for Target Zero Training. You have access to all their courses, dates, availability, and prices via function calls. 
Today's date is ${new Date().toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })}. Always use the function if the user requests something specific.`,
  },
    {
    role: "assistant",
    content: "Hello! How can I assist you today?",
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
    if (text.includes("<div")) {
      bubble.innerHTML = text;
    } else {
      bubble.textContent = text;
    }
    wrapper.appendChild(bubble);
    chatRef.current.appendChild(wrapper);
    scrollToBottom();
  };

  const speak = (text) => {
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
  const recent = allMsgs.slice(1).slice(-6);
  const payload = [systemMessage, ...recent];

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

    const tempBubble = document.createElement("div");
    tempBubble.className = `${styles.bubbleWrap} ${styles.bot}`;
    const bubble = document.createElement("div");
    bubble.className = styles.bubble;
    bubble.textContent = "Assistant is answering...";
    tempBubble.appendChild(bubble);
    chatRef.current.appendChild(tempBubble);
    scrollToBottom();

    // 👇 Construim mesajul de citit, inclusiv nota de Refresher
    let spokenIntro = "";
    const refresherNoteMatch = fullReply.match(/⚠️ Note:.*?courses\./i);

    if (refresherNoteMatch) {
      spokenIntro = fullReply.split("⚠️")[0].trim() + ". " + refresherNoteMatch[0].replace("⚠️", "").trim();
    } else {
      const introMatch = fullReply.split(/[\n:]/)[0];
      spokenIntro = introMatch.trim().length > 0 ? introMatch.trim() + "." : fullReply.slice(0, 120);
    }

    const utterance = new SpeechSynthesisUtterance(spokenIntro);
    utterance.lang = "en-US";

    utterance.onend = () => {
      if (tempBubble && tempBubble.parentNode) tempBubble.remove();
      appendMessage(fullReply, false);
      setMessages(prev => [...prev, { role: "assistant", content: fullReply }]);
    };

    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

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
      <button className={styles.voice} onClick={startVoice}><FiMic size={34} color="#19307F" /></button>
      </div>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about courses..."
        />
        <button style={{ backgroundColor: "#25D366", color: "white", border: "none", padding: "8px 14px", borderRadius: "5px", display: "flex", alignItems: "center", gap: "6px" }} onClick={sendMessage}>
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
