// hooks/useChat.js

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage chat state, API interaction, voice input, and category selection.
 * @param {Array} initialMessages - Optional initial message list
 * @param {Array} apiFunctions - Optional function definitions for OpenAI
 * @param {String|null} messageType - Optional type filter
 */
export function useChat(initialMessages = [], apiFunctions = [], messageType = null) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const recognitionRef = useRef(null);

  const containerRef = useRef(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight });
    }
  }, [messages]);

  /**
   * Send a message through the API.
   * @param {string} text - The user text to send.
   * @param {Array} priorMessages - The existing message history.
   */
  const sendMessage = useCallback(
    async (text, priorMessages = messages) => {
      text = text.trim();
      if (!text) return;

      // Add user bubble immediately
      const userMsg = { role: 'user', content: text };
      const updatedMessages = [...priorMessages, userMsg];
      setMessages(updatedMessages);
      setInputValue('');      // clear input
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages,
            functions: apiFunctions,
            function_call: 'auto',
            type: messageType,
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'API request failed');

        // Append assistant bubble
        const assistantMsg = { role: 'assistant', html: payload.reply };
        setMessages(prev => [...prev, assistantMsg]);
      } catch (err) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    },
    [apiFunctions, messageType, messages]
  );

  // Send a course code click
  const selectCategoryCode = useCallback(
    code => {
      sendMessage(code);
    },
    [sendMessage]
  );

  // Voice recognition handlers
  const startVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-GB';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setShowVoiceModal(true);
    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      setShowVoiceModal(false);
      sendMessage(transcript);
    };
    recognition.onerror = () => {
      setError('Speech recognition error');
      setShowVoiceModal(false);
    };
    recognition.onend = () => setShowVoiceModal(false);

    recognition.start();
    recognitionRef.current = recognition;
  }, [sendMessage]);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    setShowVoiceModal(false);
  }, []);

  return {
    messages,
    inputValue,
    setInputValue,
    sendMessage,
    isLoading,
    error,
    containerRef,
    showVoiceModal,
    startVoice,
    stopVoice,
    selectCategoryCode,
  };
}
