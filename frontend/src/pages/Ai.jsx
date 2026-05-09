import { useState, useEffect, useRef } from "react";
import {
  Send, Mic, User, Bot, Sparkles, AlertCircle, Loader2,
  Volume2, VolumeX, MicOff, Phone,
} from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import { SpeechRecognition as CapacitorSpeech } from "@capacitor-community/speech-recognition";

// ── Hospital database (nearest first) ────────────────────────────────────
const HOSPITALS = [
  { name: "Gokak Government Hospital", phone: "tel:+918352220300", location: "Gokak, Belagavi" },
  { name: "KLE Hospital Belagavi",      phone: "tel:+918312470000", location: "Belagavi" },
  { name: "KIMS Hospital Hubli",        phone: "tel:+918362370000", location: "Hubli" },
  { name: "District Hospital Dharwad",  phone: "tel:+918362447700", location: "Dharwad" },
  { name: "National Emergency (112)",   phone: "tel:112",           location: "Anywhere" },
];

// ── Gemini setup ──────────────────────────────────────────────────────────
const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: `You are Sahayaka AI, an emergency medical triage assistant for rural India.

When a user describes symptoms or an emergency, respond with a JSON object in this EXACT format (no markdown fences, no extra text, just raw JSON):
{"severity":"CRITICAL","advice":"your advice here","callHospital":true,"summary":"one line summary"}

Severity levels:
- CRITICAL: Life-threatening (cardiac arrest, severe bleeding, unconscious, stroke, severe burns, drowning, snake bite with symptoms)
- URGENT: Needs hospital within 1-2 hours (fractures, high fever >104F, severe pain, difficulty breathing)
- MODERATE: Needs medical attention today (moderate fever, wounds, vomiting, mild breathing issues)
- LOW: Can be managed at home (minor cuts, mild fever, headache, cold)

Set callHospital=true only for CRITICAL or URGENT.
Keep advice concise, calm, step-by-step. End with: "Call 112 for real emergencies."`,
});

const LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी (Hindi)" },
  { code: "mr-IN", label: "मराठी (Marathi)" },
  { code: "bn-IN", label: "বাংলা (Bengali)" },
  { code: "ta-IN", label: "தமிழ் (Tamil)" },
  { code: "te-IN", label: "తెలుగు (Telugu)" },
  { code: "ur-PK", label: "اردو (Urdu)" },
];

const SEVERITY_CONFIG = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  label: "CRITICAL", icon: "🚨" },
  URGENT:   { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "URGENT",   icon: "⚠️" },
  MODERATE: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "MODERATE", icon: "ℹ️" },
  LOW:      { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  label: "LOW",      icon: "✅" },
};

// ── Hospital Call Modal ───────────────────────────────────────────────────
const HospitalCallModal = ({ severity, summary, onClose }) => {
  const [calledList, setCalledList] = useState([]);
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.URGENT;

  const callHospital = (index) => {
    setCalledList((prev) => [...new Set([...prev, index])]);
    window.location.href = HOSPITALS[index].phone;
  };

  return (
    <div className="hospital-modal-overlay" role="dialog" aria-modal="true">
      <div className="hospital-modal">
        <div className="hospital-modal-header" style={{ borderColor: cfg.color }}>
          <div className="hospital-severity-badge" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.icon} {cfg.label} EMERGENCY
          </div>
          <h2>Call Nearest Hospital</h2>
          {summary && <p className="hospital-summary">{summary}</p>}
        </div>
        <p className="hospital-instruction">
          Tap a hospital to call. If unavailable, try the next one.
        </p>
        <div className="hospital-list">
          {HOSPITALS.map((h, i) => (
            <div key={i} className={`hospital-item ${calledList.includes(i) ? "called" : ""}`}>
              <div className="hospital-info">
                <span className="hospital-name">{h.name}</span>
                <span className="hospital-location">{h.location}</span>
              </div>
              <button
                className="hospital-call-btn"
                onClick={() => callHospital(i)}
                style={calledList.includes(i) ? { background: "#22c55e" } : {}}
              >
                <Phone size={16} />
                {calledList.includes(i) ? "Called" : "Call"}
              </button>
            </div>
          ))}
        </div>
        <div className="hospital-modal-footer">
          <button className="hospital-close-btn" onClick={onClose}>Close</button>
          <a href="tel:112" className="hospital-emergency-btn">
            <Phone size={16} /> Call 112 Now
          </a>
        </div>
      </div>
    </div>
  );
};

// ── Severity Banner ───────────────────────────────────────────────────────
const SeverityBanner = ({ severity, summary, onCallHospital }) => {
  const cfg = SEVERITY_CONFIG[severity];
  if (!cfg) return null;
  return (
    <div className="severity-banner" style={{ background: cfg.bg, borderColor: cfg.color }}>
      <div className="severity-banner-left">
        <span className="severity-badge" style={{ background: cfg.color, color: "#fff" }}>
          {cfg.icon} {cfg.label}
        </span>
        {summary && <span className="severity-summary">{summary}</span>}
      </div>
      {(severity === "CRITICAL" || severity === "URGENT") && (
        <button className="severity-call-btn" onClick={onCallHospital} style={{ background: cfg.color }}>
          <Phone size={14} /> Call Hospital
        </button>
      )}
    </div>
  );
};

// ── Main AI Component ─────────────────────────────────────────────────────
const Ai = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "bot",
      content: "Hello! I'm Sahayaka AI, your emergency medical triage assistant. Describe your symptoms or emergency and I'll assess the severity and guide you.",
      severity: null,
    },
  ]);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("sahayaka_lang") || "en-IN"
  );
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [currentSeverity, setCurrentSeverity] = useState(null);
  const [currentSummary, setCurrentSummary] = useState("");
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const isNative = useRef(false);
  // Keep a persistent Gemini chat session so it remembers conversation history
  const chatRef = useRef(null);

  // Init Gemini chat session once
  useEffect(() => {
    chatRef.current = model.startChat({ history: [] });
  }, []);

  // Detect Capacitor native speech
  useEffect(() => {
    CapacitorSpeech.available()
      .then(({ available }) => { isNative.current = available; })
      .catch(() => { isNative.current = false; });
  }, []);

  // Web Speech Recognition fallback
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recognitionRef.current = new SR();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language;
      recognitionRef.current.onresult = (e) => {
        setInput(e.results[0][0].transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  // Update recognition language
  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = language;
    localStorage.setItem("sahayaka_lang", language);
  }, [language]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const speak = (text) => {
    if (!isSoundOn) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang?.toLowerCase().startsWith(language.split("-")[0])) ||
        voices.find((v) => v.name?.includes("Google") && v.lang?.includes("en")) ||
        voices[0];
      if (preferred) utterance.voice = preferred;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) { console.error("Synthesis error", e); }
  };

  // ── Parse AI response ─────────────────────────────────────────────────
  const parseAIResponse = (raw) => {
    try {
      // Strip any markdown fences Gemini might add despite instructions
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      // Extract first JSON object found
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.advice) return parsed;
      }
    } catch (_) {
      // fall through
    }
    return { severity: null, advice: raw, callHospital: false, summary: "" };
  };

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg = { id: Date.now(), role: "user", content: trimmed, severity: null };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setError(null);
    try {
      window.speechSynthesis.cancel();
    } catch (e) { console.error("Speech sync error", e); }

    try {
      const langLabel = LANGUAGES.find((l) => l.code === language)?.label || "English";
      const prompt = `Respond in ${langLabel}. User says: ${trimmed}`;

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("AI request timed out. Please check your internet connection or try again.")), 15000)
      );

      const result = await Promise.race([
        chatRef.current.sendMessage(prompt),
        timeoutPromise
      ]);
      const rawText = result.response.text();

      const parsed = parseAIResponse(rawText);
      const { severity, advice, callHospital, summary } = parsed;

      if (severity) {
        setCurrentSeverity(severity);
        setCurrentSummary(summary || "");
        if (severity === "CRITICAL" && callHospital) {
          setTimeout(() => setShowHospitalModal(true), 1500);
        }
      }

      const botMsg = {
        id: Date.now() + 1,
        role: "bot",
        content: advice,
        severity: severity || null,
        summary: summary || "",
      };
      setMessages((prev) => [...prev, botMsg]);
      try {
        speak(advice);
      } catch (e) { console.error("Speak error", e); }
    } catch (err) {
      console.error("Gemini Error:", err);
      let errorMessage = "Could not reach AI. Check your internet connection.";
      if (err.message?.includes("429") || err.message?.includes("quota")) {
        errorMessage = "The AI system is currently busy or has exceeded its quota limit. Please try again in a few moments.";
      }
      setError(errorMessage);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          content: `I'm having trouble connecting right now (${errorMessage}). Please call **112** for emergencies.`,
          severity: null,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── Mic toggle ────────────────────────────────────────────────────────
  const toggleMic = async () => {
    if (isListening) {
      if (isNative.current) await CapacitorSpeech.stop();
      else recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    setInput("");
    setIsListening(true);
    if (isNative.current) {
      const { speechRecognition } = await CapacitorSpeech.requestPermissions();
      if (speechRecognition !== "granted") { setIsListening(false); return; }
      try {
        const result = await CapacitorSpeech.start({
          language,
          maxResults: 1,
          prompt: "Describe your emergency or symptoms",
          partialResults: false,
          popup: false,
        });
        if (result?.matches?.length > 0) setInput(result.matches[0]);
      } catch (err) {
        console.error("Capacitor Speech Error:", err);
      } finally {
        setIsListening(false);
      }
    } else {
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="ai-chat-container full-screen">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-header-left">
          <div className="ai-header-icon">
            <Sparkles size={22} color="var(--primary)" />
          </div>
          <div>
            <h2 className="ai-header-title">Medical Triage AI</h2>
            <div className="ai-status-row">
              <div className="status-dot connected"></div>
              <span className="status-label">Gemini 2.5 Flash</span>
            </div>
          </div>
        </div>

        <div className="ai-header-right">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="lang-select"
            aria-label="Select language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>

          <button
            className={`chat-action-btn ${isSoundOn ? "active" : ""}`}
            onClick={() => {
              setIsSoundOn(!isSoundOn);
              if (isSoundOn) window.speechSynthesis.cancel();
            }}
            title={isSoundOn ? "Mute" : "Unmute"}
          >
            {isSoundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </div>

      {/* Severity Banner */}
      {currentSeverity && (
        <SeverityBanner
          severity={currentSeverity}
          summary={currentSummary}
          onCallHospital={() => setShowHospitalModal(true)}
        />
      )}

      {/* Messages */}
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.role}`}>
            {/* Severity tag on bot messages */}
            {msg.role === "bot" && msg.severity && (
              <div
                className="msg-severity-tag"
                style={{
                  background: SEVERITY_CONFIG[msg.severity]?.bg,
                  color: SEVERITY_CONFIG[msg.severity]?.color,
                  borderColor: SEVERITY_CONFIG[msg.severity]?.color,
                }}
              >
                {SEVERITY_CONFIG[msg.severity]?.icon} {msg.severity}
                {(msg.severity === "CRITICAL" || msg.severity === "URGENT") && (
                  <button
                    className="msg-call-btn"
                    onClick={() => setShowHospitalModal(true)}
                    style={{ color: SEVERITY_CONFIG[msg.severity]?.color }}
                  >
                    <Phone size={12} /> Call Hospital
                  </button>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div className={`bubble-avatar ${msg.role}`}>
                {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className="markdown-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="chat-bubble bot" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "1rem 1.25rem" }}>
            <Loader2 size={18} className="animate-spin" />
            <span style={{ fontSize: "0.95rem", color: "var(--accents-3)", fontWeight: 500 }}>
              Sahayaka is analyzing...
            </span>
          </div>
        )}

        {error && (
          <div className="connection-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-wrapper">
        <div className="chat-input-container">
          <button
            className={`chat-action-btn chat-mic-btn ${isListening ? "active" : ""}`}
            onClick={toggleMic}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? <Mic size={22} /> : <MicOff size={22} />}
          </button>

          <input
            className="chat-input"
            type="text"
            placeholder={isListening ? "Listening..." : "Describe symptoms (e.g. 'sharp chest pain')..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isTyping && handleSend()}
          />

          <button
            className="chat-action-btn chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
          >
            <Send size={20} />
          </button>
        </div>
        <p className="disclaimer-text">
          AI advice does not replace professional diagnosis. In emergencies, call 112.
        </p>
      </div>

      {/* Hospital Call Modal */}
      {showHospitalModal && (
        <HospitalCallModal
          severity={currentSeverity}
          summary={currentSummary}
          onClose={() => setShowHospitalModal(false)}
        />
      )}
    </div>
  );
};

export default Ai;
