// ChatUI.js (Next.js component complet, cu voce + HTML interactiv pentru cursuri)
import { useEffect, useRef, useState } from "react";
import styles from "../styles/Chat.module.css";

export default function ChatUI() {
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "system",
      content:
        "You are a helpful assistant for Target Zero Training. You have access to all their courses, dates, availability, and prices via function calls. Always use the function if the user requests something specific.",
    },
  ]);
  const [recognition, setRecognition] = useState(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      const target = e.target.closest(".mainCourse");
      if (target) {
        const body = target.nextElementSibling;
        const arrow = target.querySelector(".arrow");
        if (body && arrow) {
          const isOpen = body.style.display === "block";
          body.style.display = isOpen ? "none" : "block";
          arrow.textContent = isOpen ? "▼" : "▲";
        }
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

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
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
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
    const updatedMessages = [...messages, { role: "user", content: value }];
    setMessages(updatedMessages);
    setInput("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          functions: [
            {
              name: "searchCourses",
              description: "Finds Target Zero Training courses using title keywords and optional filters like month or availability.",
              parameters: {
                type: "object",
                properties: {
                  keyword: { type: "string", description: "Search keyword like SMSTS, HSA, etc." },
                  month: { type: "string", description: "Optional. Filter by course start month (e.g. July)" },
                  location: { type: "string", description: "Optional. Filter by city or training location (e.g. Chelmsford)" },
                  require_available_spaces: { type: "boolean", description: "Optional. If true, returns only courses with available seats." }
                },
                required: ["keyword"]
              }
            }
          ],
          function_call: "auto"
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.reply) {
        const errorText = data.error || "Error from OpenAI.";
        appendMessage(errorText, false);
        return;
      }

      const reply = data.reply;
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      appendMessage(reply, false);
      speak(reply);

    } catch (error) {
      console.error("Frontend fetch error:", error);
      appendMessage("Network error. Please try again later.", false);
    }
  };

  const startVoice = () => {
    if (!("webkitSpeechRecognition" in window)) return alert("Browser does not support voice input");
    const rec = new webkitSpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setShowVoiceModal(false);
      setTimeout(() => sendMessage(), 300);
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

      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about courses..."
        />
        <div className={styles.buttons}>
          <button onClick={sendMessage}>Send</button>
          <button onClick={startVoice}>🎤 Speak</button>
          <button onClick={stopVoice}>🔇 Stop</button>
        </div>
      </div>

      {showVoiceModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>Speak now!</div>
        </div>
      )}
    </div>
  );
}
