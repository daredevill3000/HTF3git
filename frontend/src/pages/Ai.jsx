import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import { Send, Mic, User, Bot, Sparkles, AlertCircle, Loader2, Volume2, VolumeX, MicOff } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import { SpeechRecognition as CapacitorSpeech } from "@capacitor-community/speech-recognition";

const MQTT_BROKER = "wss://broker.emqx.io:8084/mqtt";
const TOPIC_SUB = "sahayaka/ai/response";
const TOPIC_PUB = "sahayaka/ai/query";

// Initialize Gemini
const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: "You are Sahayaka AI, an emergency medical triage assistant for remote India. Provide calm, clear, and concise advice. Ask clarifying questions about symptoms. Always include a disclaimer that you are an AI and the user should call 112 for real emergencies."
});

const Ai = () => {
  const [messages, setMessages] = useState([
    { id: 1, role: "bot", content: "Hello! I'm your AI Triage assistant. Please describe your emergency or symptoms, and I'll help you determine the next steps." }
  ]);
  const languages = [
    { code: 'en-IN', label: 'English' },
    { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
    { code: 'mr-IN', label: 'मराठी (Marathi)' },
    { code: 'bn-IN', label: 'বাংলা (Bengali)' },
    { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
    { code: 'te-IN', label: 'తెలుగు (Telugu)' },
    { code: 'ur-PK', label: 'اردو (Urdu)' }
  ];
  const [language, setLanguage] = useState(() => localStorage.getItem('sahayaka_lang') || 'en-IN');
  const [input, setInput] = useState("");
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const isNative = useRef(false); // true when running inside Capacitor on Android

  // Detect if Capacitor native speech is available
  useEffect(() => {
    CapacitorSpeech.available()
      .then(({ available }) => {
        isNative.current = available;
      })
      .catch(() => {
        isNative.current = false;
      });
  }, []);

  // Initialize Web Speech Recognition (browser / desktop fallback)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language || "en-IN";

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Update recognition language when user changes selection
  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = language;
    localStorage.setItem('sahayaka_lang', language);
  }, [language]);

  // Text to Speech function
  const speak = (text) => {
    if (!isSoundOn) return;
    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a good natural voice
    const voices = window.speechSynthesis.getVoices();
    // prefer a voice that matches the selected language code
    const preferredVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(language.split('-')[0]))
      || voices.find(v => v.name && v.name.includes("Google") && v.lang && v.lang.includes("en"))
      || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // MQTT Connection
  useEffect(() => {
    const mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: `sahayaka_${Math.random().toString(16).slice(3)}`,
    });

    mqttClient.on("connect", () => {
      setStatus("connected");
      mqttClient.subscribe(TOPIC_SUB);
    });

    mqttClient.on("message", (topic, message) => {
      if (topic === TOPIC_SUB) {
        let responseText = message.toString();
        // try to parse JSON { text, lang }
        try {
          const parsed = JSON.parse(responseText);
          if (parsed && parsed.text) {
            responseText = parsed.text;
            // if parsed.lang exists, optionally change language temporarily for TTS
            if (parsed.lang) {
              // speak using parsed.lang if different
              const prevLang = language;
              setLanguage(parsed.lang);
              // restore after a short delay to avoid changing user preference permanently
              setTimeout(() => setLanguage(prevLang), 1000);
            }
          }
        } catch (e) {
          // not JSON - proceed
        }

        setMessages((prev) => [...prev, { id: Date.now(), role: "bot", content: responseText }]);
        speak(responseText); // Read out the AI response
      }
    });

    mqttClient.on("error", (err) => {
      console.error("MQTT Error:", err);
      setStatus("error");
    });

    setClient(mqttClient);

    return () => {
      if (mqttClient) {
        mqttClient.end();
        window.speechSynthesis.cancel();
      }
    };
  }, [isSoundOn]);

  const handleSend = async () => {
    if (!input.trim() || !client) return;

    const userMsg = { id: Date.now(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    window.speechSynthesis.cancel(); // Stop AI if user starts typing/sending

    client.publish(TOPIC_PUB, input);

    try {
      // Instruct the model to reply in the selected language
      const prompt = `Respond in ${languages.find(l => l.code === language)?.label || 'English'}:\n\n${input}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      // Publish JSON so listeners know the language
      client.publish(TOPIC_SUB, JSON.stringify({ text, lang: language }));
    } catch (error) {
      console.error("Gemini Error:", error);
      client.publish(TOPIC_SUB, JSON.stringify({ text: "I'm having trouble connecting to my brain right now. Please try again later.", lang: language }));
    } finally {
      setIsTyping(false);
    }
  };

  const toggleMic = async () => {
    if (isListening) {
      // Stop listening
      if (isNative.current) {
        await CapacitorSpeech.stop();
      } else {
        recognitionRef.current?.stop();
      }
      setIsListening(false);
      return;
    }

    // Start listening
    setInput("");
    setIsListening(true);

    if (isNative.current) {
      // Request permission first
      const { speechRecognition } = await CapacitorSpeech.requestPermission();
      if (speechRecognition !== "granted") {
        console.error("Microphone permission denied");
        setIsListening(false);
        return;
      }
      try {
        const result = await CapacitorSpeech.start({
          language: language || "en-IN",
          maxResults: 1,
          prompt: "Describe your emergency or symptoms",
          partialResults: false,
          popup: false,
        });
        if (result?.matches?.length > 0) {
          setInput(result.matches[0]);
        }
      } catch (err) {
        console.error("Capacitor Speech Error:", err);
      } finally {
        setIsListening(false);
      }
    } else {
      // Browser fallback
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="ai-chat-container full-screen">
      {/* Header Info */}
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--accents-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ background: "rgba(230, 57, 70, 0.1)", padding: "10px", borderRadius: "14px" }}>
            <Sparkles size={22} color="var(--primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "800" }}>Medical Triage AI</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: status === "connected" ? "#22c55e" : "#f59e0b" }}></div>
              <span style={{ fontSize: "0.8rem", color: "var(--accents-3)", textTransform: "capitalize", fontWeight: "600" }}>{status}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label htmlFor="lang-select" style={{ fontSize: '0.85rem', color: 'var(--accents-4)', marginRight: 6 }}>Language</label>
          <select id="lang-select" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--accents-2)' }}>
            {languages.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <button 
          className={`chat-action-btn ${isSoundOn ? 'active' : ''}`}
          onClick={() => {
            setIsSoundOn(!isSoundOn);
            if (isSoundOn) window.speechSynthesis.cancel();
          }}
          style={{ width: "44px", height: "44px" }}
          title={isSoundOn ? "Turn sound off" : "Turn sound on"}
        >
          {isSoundOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>
      </div>

      {/* Messages Area */}
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.role}`}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: msg.role === "user" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className="markdown-content" style={{ flex: 1, overflowWrap: "break-word" }}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="chat-bubble bot" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "1rem 1.25rem" }}>
            <Loader2 size={18} className="animate-spin" />
            <span style={{ fontSize: "0.95rem", color: "var(--accents-3)", fontWeight: "500" }}>Sahayaka is analyzing...</span>
          </div>
        )}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "#e63946", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgba(230, 57, 70, 0.05)", borderRadius: "12px", margin: "1rem" }}>
            <AlertCircle size={16} /> Connection lost. Retrying...
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-wrapper">
        <div className="chat-input-container">
          <button
            className={`chat-action-btn chat-mic-btn ${isListening ? 'active' : ''}`}
            onClick={toggleMic}
            title={isListening ? "Stop listening" : "Start voice typing"}
          >
            {isListening ? <Mic size={22} /> : <MicOff size={22} />}
          </button>

          <input
            className="chat-input"
            type="text"
            placeholder={isListening ? "Listening..." : "Describe symptoms (e.g. 'sharp chest pain')..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />

          <button
            className="chat-action-btn chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || status !== "connected" || isTyping}
          >
            <Send size={20} />
          </button>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--accents-3)", textAlign: "center", marginTop: "1rem", opacity: 0.8 }}>
          AI-generated medical advice should not replace a professional diagnosis. In case of emergency, call 112.
        </p>
      </div>
    </div>
  );
};

export default Ai;