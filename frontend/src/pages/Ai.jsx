import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import {
  Send, Mic, User, Bot, Sparkles, AlertCircle, Loader2,
  Volume2, VolumeX, MicOff, Phone, AlertTriangle, CheckCircle,
} from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import { SpeechRecognition as CapacitorSpeech } from "@capacitor-community/speech-recognition";

const MQTT_BROKER = "wss://broker.emqx.io:8084/mqtt";
const TOPIC_SUB = "sahayaka/ai/response";
const TOPIC_PUB = "sahayaka/ai/query";

// ── Hospital database (nearest first) ────────────────────────────────────
const HOSPITALS = [
  { name: "Gokak Government Hospital",   phone: "tel:+918352220300", location: "Gokak, Belagavi" },
  { name: "KLE Hospital Belagavi",        phone: "tel:+918312470000", location: "Belagavi" },
  { name: "KIMS Hospital Hubli",          phone: "tel:+918362370000", location: "Hubli" },
  { name: "District Hospital Dharwad",    phone: "tel:+918362447700", location: "Dharwad" },
  { name: "National Emergency (112)",     phone: "tel:112",           location: "Anywhere" },
];

// ── Gemini setup ──────────────────────────────────────────────────────────
const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: `You are Sahayaka AI, an emergency medical triage assistant for rural India.

When a user describes symptoms or an emergency, respond with a JSON object in this EXACT format (no markdown, no extra text):
{
  "severity": "CRITICAL" | "URGENT" | "MODERATE" | "LOW",
  "advice": "Your clear, calm, step-by-step advice here in plain text",
  "callHospital": true | false,
  "summary": "One-line summary of the situation"
}

Severity guidelines:
- CRITICAL: Life-threatening (cardiac arrest, severe bleeding, unconscious, stroke, severe burns, drowning, snake bite with symptoms)
- URGENT: Needs hospital within 1-2 hours (fractures, high fever >104°F, severe pain, difficulty breathing)
- MODERATE: Needs medical attention today (moderate fever, wounds, vomiting, mild breathing issues)
- LOW: Can be managed at home with guidance (minor cuts, mild fever, headache, cold)

Set callHospital=true only for CRITICAL or URGENT cases.
Always include a disclaimer at the end of advice to call 112 for real emergencies.
Keep advice concise and actionable. Use simple language.`,
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
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  label: "CRITICAL",  icon: "🚨" },
  URGENT:   { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "URGENT",    icon: "⚠️" },
  MODERATE: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "MODERATE",  icon: "ℹ️" },
  LOW:      { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  label: "LOW",       icon: "✅" },
};

// ── Hospital Call Modal ───────────────────────────────────────────────────
const HospitalCallModal = ({ severity, summary, onClose }) => {
  const [calledIndex, setCalledIndex] = useState(null);
  const [calledList, setCalledList] = useState([]);

  const callHospital = (index) => {
    setCalledIndex(index);
    setCalledList((prev) => [...new Set([...prev, index])]);
    window.location.href = HOSPITALS[index].phone;
  };

  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.URGENT;

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
          <button className="hospital-close-btn" onClick={onClose}>
            Close
          </button>
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
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [currentSeverity, setCurrentSeverity] = useState(null);
  const [currentSummary, setCurrentSummary] = useState("");
  const [showHospitalModal, setShowHospitalModal] = useState(false);

  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const isNative = useRef(false);

  // Detect Capacitor native speech
  useEffect(() => {
    CapacitorSpeech.available()
      .then(({ available }) => { isNative.current = available; })
      .catch(() => { isNative.current = false; });
  }, []);

  // Web Speech Recognition fallback
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
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

  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = language;
    localStorage.setItem("sahayaka_lang", language);
  }, [language]);

  const speak = (text) => {
    if (!isSoundOn) return;
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
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // MQTT
  useEffect(() => {
    const mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: `sahayaka_${Math.random().toString(16).slice(3)}`,
    });
    mqttClient.on("connect", () => {
      setStatus("connected");
      mqttClient.subscribe(TOPIC_SUB);
    });
    mqttClient.on("error", () => setStatus("error"));
    setClient(mqttClient);
    return () => {
      mqttClient.end();
      window.speechSynthesis.cancel();
    };
  }, [isSoundOn]);

  // ── Parse AI response ─────────────────────────────────────────────────
  const parseAIResponse = (raw) => {
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.severity && parsed.advice) return parsed;
    } catch (_) {
      // Not JSON — treat as plain advice
    }
    return { severity: null, advice: raw, callHospital: false, summary: "" };
  };

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !client) return;

    const userMsg = { id: Date.now(), role: "user", content: input, severity: null };
    setMessages((prev) => [...prev, userMsg]);
    const userInput = input;
    setInput("");
    setIsTyping(true);
    window.speechSynthesis.cancel();

    client.publish(TOPIC_PUB, userInput);

    try {
      const langLabel = LANGUAGES.find((l) => l.code === language)?.label || "English";
      const prompt = `Respond in ${langLabel}. User says: ${userInput}`;
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();

      const parsed = parseAIResponse(rawText);
      const { severity, advice, callHospital, summary } = parsed;

      // Update severity state
      if (severity) {
        setCurrentSeverity(severity);
        setCurrentSummary(summary || "");
        // Auto-show hospital modal for CRITICAL
        if (severity === "CRITICAL" && callHospital) {
          setTimeout(() => setShowHospitalModal(true), 1500);
        }
      }

      const botMsg = {
        id: Date.now() + 1,
        role: "bot",
        content: advice,
        severity,
        summary,
      };
      setMessages((prev) => [...prev, botMsg]);
      speak(advice);

      client.publish(TOPIC_SUB, JSON.stringify({ text: advice, lang: language }));
    } catch (err) {
      console.error("Gemini Error:", err);
      const errMsg = {
        id: Date.now() + 1,
        role: "bot",
        content: "I'm having trouble connecting right now. Please try again, or call 112 for emergencies.",
        severity: null,
      };
      setMessages((prev) => [...prev, errMsg]);
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
              <div className={`status-dot ${status}`}></div>
              <span className="status-label">{status}</span>
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
          <div className="chat-bubble bot typing-indicator">
            <Loader2 size={18} className="animate-spin" />
            <span>Sahayaka is analyzing...</span>
          </div>
        )}

        {status === "error" && (
          <div className="connection-error">
            <AlertCircle size={16} /> Connection lost. Retrying...
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
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />

          <button
            className="chat-action-btn chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || status !== "connected" || isTyping}
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
