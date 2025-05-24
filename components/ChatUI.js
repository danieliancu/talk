// components/ChatUI.js

import { useEffect, useRef, useState } from "react";
import { FiMic } from "react-icons/fi";
import { FaPaperPlane, FaPowerOff } from "react-icons/fa";
import styles from "../styles/Chat.module.css";
import { keywordSynonyms } from "@/lib/search";
import coursesData from "../data/coursesCatalog.json";

export default function ChatUI() {
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("CITB");

  const handleCodeClick = (code) => {
    setSelectedCode(code);
    appendMessage(code.toUpperCase(), true);
    const updatedMessages = [...messages, { role: "user", content: code }];
    setMessages(updatedMessages);
    sendToAPI(code, updatedMessages);
  };


  const [isInputFocused, setIsInputFocused] = useState(false);

  const shouldHidePlaceholder = isInputFocused || input.trim().length > 0;

  const [selectedCode, setSelectedCode] = useState(null);


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
    content: `Welcome! You can search for a training course by typing, speaking, or selecting one from the menu above.`,
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





  } catch (err) {
    console.error("Error:", err);
    appendMessage("Network error. Please try again later.", false);
  }
};



const startVoice = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Your browser does not support voice recognition.");
    return;
  }

  const recognitionInstance = new SpeechRecognition();
  recognitionInstance.lang = "en-GB";
  recognitionInstance.interimResults = false;
  recognitionInstance.maxAlternatives = 1;

  recognitionInstance.onstart = () => {
    setShowVoiceModal(true);
  };

  recognitionInstance.onerror = () => {
    appendMessage("❗Speech recognition error. Please try again.", true);
    setShowVoiceModal(false);
  };

  recognitionInstance.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    appendMessage(transcript, true);
    const updatedMessages = [...messages, { role: "user", content: transcript }];
    setMessages(updatedMessages);
    sendToAPI(transcript, updatedMessages);
    setShowVoiceModal(false);
  };

  recognitionInstance.onend = () => {
    setShowVoiceModal(false);
  };

  recognitionInstance.start();
  setRecognition(recognitionInstance);
};


  const stopVoice = () => {
    if (recognition) recognition.stop();
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    setShowVoiceModal(false);
  };



  return (
    <div className={styles.container}>
      <div ref={chatRef} className={styles.chat}>
        <div className={styles.top}>
          <div className={styles.menu}>
            {Object.keys(coursesData).map((category) => (
              <span
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={{
                  cursor: "pointer",
                  backgroundColor: selectedCategory === category ? "#e77b1b" : "transparent",
                  color: selectedCategory === category ? "white" : "black",
                }}
              >
                {category}
              </span>
            ))}
          </div>
          <div className={styles.submenu}>
            {Object.keys(coursesData[selectedCategory]).map((code) => (
              <span
                key={code}
                onClick={() => handleCodeClick(code)}
                className={selectedCode === code ? styles.selected : ""}
              >
                {code.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

      </div>
      <div className={styles.voiceWrap}>
      <button className={styles.voiceClose} onClick={()=>window.location.reload()}><FaPowerOff size={34} color="white" /></button>
      </div>

<div className={styles.inputWrap}>
  <div className={`${styles.placeholderWrap} ${shouldHidePlaceholder ? styles.hidden : ""}`}>
    Find your course by <span className={styles.rotating}><span>typing</span><span>speaking</span></span>
  </div>

  <button className={styles.voice} onClick={startVoice}><FiMic size={34} color="#19307F" /></button>
  <input
    ref={inputRef}
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onFocus={() => setIsInputFocused(true)}
    onBlur={() => setIsInputFocused(false)}
    placeholder=""
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
