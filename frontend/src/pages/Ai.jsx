import { useState, useEffect, useRef } from "react";
import {
  Send, Mic, User, Bot, Sparkles, AlertCircle, Loader2,
  Volume2, VolumeX, MicOff, Phone, MapPin, Map, Square
} from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import { SpeechRecognition as CapacitorSpeech } from "@capacitor-community/speech-recognition";
import { Capacitor } from "@capacitor/core";
// ── Hospital database (nearest first) ────────────────────────────────────
const HOSPITALS = [
  { name: "Gokak Government Hospital", phone: "tel:+918352220300", location: "Gokak, Belagavi", lat: 16.1667, lng: 74.8333 },
  { name: "KLE Hospital Belagavi", phone: "tel:+918312470000", location: "Belagavi", lat: 15.8677, lng: 74.5089 },
  { name: "KIMS Hospital Hubli", phone: "tel:+918362370000", location: "Hubli", lat: 15.3647, lng: 75.1240 },
  { name: "District Hospital Dharwad", phone: "tel:+918362447700", location: "Dharwad", lat: 15.4589, lng: 75.0078 },
  { name: "National Emergency (112)", phone: "tel:112", location: "Anywhere", lat: null, lng: null },
];

// ── Gemini setup (Dynamic) ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Sahayaka AI, an emergency medical triage assistant for rural India.

When a user describes symptoms or an emergency, respond with a JSON object in this EXACT format (no markdown fences, no extra text, just raw JSON):
{"severity":"CRITICAL","advice":"your advice here","callHospital":true,"summary":"one line summary","languageCode":"en-IN"}

"languageCode" MUST be the BCP-47 language code of your response (e.g. "en-IN", "hi-IN", "ta-IN").
Respond in the exact same language that the user used in their input!

Severity levels:
- CRITICAL: Life-threatening (cardiac arrest, severe bleeding, unconscious, stroke, severe burns, drowning, snake bite with symptoms)
- URGENT: Needs hospital within 1-2 hours (fractures, high fever >104F, severe pain, difficulty breathing)
- MODERATE: Needs medical attention today (moderate fever, wounds, vomiting, mild breathing issues)
- LOW: Can be managed at home (minor cuts, mild fever, headache, cold)

Set callHospital=true only for CRITICAL or URGENT.
Keep advice concise, calm, step-by-step. End with: "Call 112 for real emergencies."`;

const getGenerativeModel = () => {
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });
};

const LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी (Hindi)" },
  { code: "mr-IN", label: "मराठी (Marathi)" },
  { code: "bn-IN", label: "বাংলা (Bengali)" },
  { code: "ta-IN", label: "தமிழ் (Tamil)" },
  { code: "te-IN", label: "తెలుగు (Telugu)" },
  { code: "ur-PK", label: "اردو (Urdu)" },
];

const OFFLINE_EMERGENCY_DATA = [
  {
    id: "snake_bite",
    keywords: ["snake", "bite", "venom", "saap", "saanp", "सांप", "சாம்பு", "పాము", "பாம்பு", "साप", "সাপ", "பாம்பு", "కಚ್ಚುವುದು"],
    severity: "CRITICAL",
    summary: "Immediate care for snake bite to prevent venom spread.",
    advice: `### SNAKE BITE - EMERGENCY RESPONSE
**Objective:** Prevent venom spread and stabilize the victim until medical help arrives.

**Common Symptoms:**
- Fang marks or swelling
- Severe pain around bite
- Nausea or dizziness
- Difficulty breathing
- Blurred vision

**Immediate Actions:**
1. Keep the victim calm and still
2. Immobilize the bitten limb
3. Keep limb below heart level
4. Remove rings/tight clothing
5. Call emergency services immediately

**THINGS TO AVOID:**
- Cut the wound
- Suck the venom
- Apply ice or chemicals
- Use tight tourniquets

**Medical Attention:**
- Immediate hospital transport
- Antivenom may be required
- Monitor breathing continuously

**Safety Tip:** "Less movement = slower venom spread."`
  },
  {
    id: "severe_bleeding",
    keywords: ["bleed", "blood", "cut", "wound", "khoon", "rakta", "खून", "रक्त", "రక్తం", "ரத்தம்", "খুন", "রক্তপাত"],
    severity: "CRITICAL",
    summary: "Control blood loss rapidly to prevent shock.",
    advice: `### SEVERE BLEEDING - EMERGENCY RESPONSE
**Objective:** Control blood loss rapidly to prevent shock.

**Immediate Actions:**
1. Apply direct pressure
2. Use clean cloth/bandage
3. Elevate injured area if possible

**If Bleeding Continues:**
- Add extra dressings
- Maintain constant pressure

**Signs of Shock:**
- Pale skin
- Weak pulse
- Confusion
- Cold sweating

**DO NOT:**
- Remove embedded objects
- Delay medical care

**Safety Tip:** "Direct pressure saves lives."`
  },
  {
    id: "heat_stroke",
    keywords: ["heat", "sun", "stroke", "dehydration", "garmi", "bhadi", "गर्मी", "बढ़ती", "ಬಿಸಿಲು", "வெப்பம்", "উত্তাপ"],
    severity: "URGENT",
    summary: "Lower body temperature rapidly.",
    advice: `### HEAT STROKE - EMERGENCY RESPONSE
**Objective:** Lower body temperature rapidly.

**Symptoms:**
- High body temperature
- Hot dry skin
- Confusion
- Rapid pulse
- Collapse

**Immediate Actions:**
1. Move to cool area
2. Remove excess clothing
3. Apply cool wet cloths
4. Give water if conscious

**Avoid:**
- Alcohol/caffeine
- Delaying treatment

**Medical Emergency:**
Heat stroke can become fatal quickly.

**Safety Tip:** "Rapid cooling can save life."`
  },
  {
    id: "heart_attack",
    keywords: ["heart", "chest", "cardiac", "attack", "dil", "hridaya", "हृदय", "दिल", "ಹೃದಯ", "இதயம்", "হৃদয়"],
    severity: "CRITICAL",
    summary: "Restore blood flow quickly and maintain breathing.",
    advice: `### HEART ATTACK - EMERGENCY RESPONSE
**Objective:** Restore blood flow quickly and maintain breathing/circulation.

**Warning Signs:**
- Chest pain or pressure
- Pain in arm/jaw/back
- Sweating
- Shortness of breath
- Nausea or dizziness

**Immediate Actions:**
1. Call emergency services
2. Make patient sit calmly
3. Loosen tight clothing
4. Give aspirin if conscious & not allergic

**If Unresponsive:**
- Start CPR immediately
- Use AED if available

**CPR Protocol:**
- 100-120 chest compressions/min
- Push hard and fast at chest center

**Safety Tip:** "Every second saved protects heart muscle."`
  },
  {
    id: "fracture",
    keywords: ["bone", "break", "fracture", "haddi", "mule", "हड्डी", "ಮೂಳೆ", "எலும்பு", "হাড়"],
    severity: "URGENT",
    summary: "Immobilize injury and prevent further damage.",
    advice: `### FRACTURE / BROKEN BONE - EMERGENCY RESPONSE
**Objective:** Immobilize injury and prevent further damage.

**Symptoms:**
- Severe pain
- Swelling
- Deformity
- Inability to move limb

**Immediate Actions:**
1. Keep injured area still
2. Apply splint if trained
3. Use wrapped ice pack
4. Elevate if possible

**DO NOT:**
- Straighten bone
- Move victim unnecessarily

**Seek Urgent Care If:**
- Open fracture
- Numbness
- Heavy bleeding

**Safety Tip:** "Immobilization prevents complications."`
  },
  {
    id: "fall",
    keywords: ["fall", "height", "girna", "bilu", "गिरना", "ಬೀಳುವುದು", "விழு", "পড়ে"],
    severity: "CRITICAL",
    summary: "Prevent further injury and stabilize possible spinal trauma.",
    advice: `### FALL FROM HEIGHT - EMERGENCY RESPONSE
**Objective:** Prevent further injury and stabilize possible spinal trauma.

**Possible Injuries:**
- Head injury
- Fractures
- Internal bleeding
- Spinal damage

**Immediate Actions:**
1. Do not move victim unnecessarily
2. Call emergency services
3. Check breathing & consciousness
4. Stabilize neck/head

**If Bleeding Occurs:**
- Apply gentle pressure
- Avoid pressing exposed bone

**Emergency Warning Signs:**
- Loss of consciousness
- Difficulty breathing
- Severe deformity

**Safety Tip:** "Always suspect spinal injury after major falls."`
  },
  {
    id: "electric_shock",
    keywords: ["electric", "shock", "wire", "current", "bijli", "vidyut", "बिजली", "ವಿದ್ಯುತ್", "மின்சாரம்", "বিদ্যুৎ"],
    severity: "CRITICAL",
    summary: "Ensure scene safety and restore vital functions.",
    advice: `### ELECTRIC SHOCK - EMERGENCY RESPONSE
**Objective:** Ensure scene safety and restore vital functions.

**Immediate Actions:**
1. Turn off electrical source
2. Do NOT touch victim directly
3. Use non-conductive object if needed

**Assess Victim:**
- Breathing
- Pulse
- Burns
- Consciousness

**If Unresponsive:**
- Start CPR
- Call emergency services

**Burn Care:**
- Cool burns with water
- Cover with sterile dressing

**Safety Tip:** "Your safety comes first before rescue."`
  },
  {
    id: "drowning",
    keywords: ["drown", "water", "swim", "pani", "neer", "डूबना", "ಮುಳುಗುವುದು", "நீரில்", "ডুবে"],
    severity: "CRITICAL",
    summary: "Restore breathing and oxygen supply quickly.",
    advice: `### DROWNING - EMERGENCY RESPONSE
**Objective:** Restore breathing and oxygen supply quickly.

**Immediate Actions:**
1. Remove victim from water safely
2. Call emergency services
3. Check breathing & pulse

**If Not Breathing:**
- Start rescue breaths
- Begin CPR immediately

**Recovery Position:**
- Place on side if breathing normally
- Keep victim warm

**Important Notes:**
- All drowning victims need medical evaluation
- Watch for delayed breathing problems

**Safety Tip:** "Early CPR greatly improves survival."`
  }
];

const SEVERITY_CONFIG = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "CRITICAL", icon: "🚨" },
  URGENT: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "URGENT", icon: "⚠️" },
  MODERATE: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "MODERATE", icon: "ℹ️" },
  LOW: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "LOW", icon: "✅" },
};

// ── Hospital Call Modal ───────────────────────────────────────────────────
const HospitalCallModal = ({ severity, summary, onClose }) => {
  const [calledList, setCalledList] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(0);
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.URGENT;

  const callHospital = (index) => {
    setCalledList((prev) => [...new Set([...prev, index])]);
    window.location.href = HOSPITALS[index].phone;
  };

  const hospital = HOSPITALS[selectedHospital];
  const mapUrl = hospital.lat
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${hospital.lng - 0.01}%2C${hospital.lat - 0.01}%2C${hospital.lng + 0.01}%2C${hospital.lat + 0.01}&layer=mapnik&marker=${hospital.lat}%2C${hospital.lng}`
    : null;

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

        {/* Embedded Map Section */}
        {mapUrl && (
          <div className="hospital-map-container">
            <iframe
              title="Hospital Location"
              width="100%"
              height="180"
              frameBorder="0"
              scrolling="no"
              marginHeight="0"
              marginWidth="0"
              src={mapUrl}
              style={{ border: 'none', borderRadius: '12px' }}
            ></iframe>
            <div className="map-overlay-info">
              <MapPin size={12} />
              <span>{hospital.name}</span>
            </div>
          </div>
        )}

        <p className="hospital-instruction">
          Tap a hospital to see on map and call.
        </p>
        <div className="hospital-list">
          {HOSPITALS.map((h, i) => (
            <div
              key={i}
              className={`hospital-item ${calledList.includes(i) ? "called" : ""} ${selectedHospital === i ? "selected" : ""}`}
              onClick={() => setSelectedHospital(i)}
              style={{ cursor: 'pointer' }}
            >
              <div className="hospital-info">
                <span className="hospital-name">{h.name}</span>
                <span className="hospital-location">{h.location}</span>
              </div>
              <div className="hospital-item-actions">
                {h.lat && <Map size={16} className="map-indicator-icon" />}
                <button
                  className="hospital-call-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    callHospital(i);
                  }}
                  style={calledList.includes(i) ? { background: "#22c55e" } : {}}
                >
                  <Phone size={16} />
                  {calledList.includes(i) ? "Called" : "Call"}
                </button>
              </div>
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
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  // Keep a persistent Gemini chat session so it remembers conversation history
  const chatRef = useRef(null);

  // Init Gemini chat session once
  useEffect(() => {
    chatRef.current = getGenerativeModel().startChat({ history: [] });
  }, []);

  // Update recognition language
  useEffect(() => {
    localStorage.setItem("sahayaka_lang", language);
  }, [language]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const speakWithBulbul = async (text, langCode) => {
    if (!isSoundOn) return;
    const apiKey = import.meta.env.VITE_SARVAM_API_KEY;
    if (!apiKey) {
      console.warn("No Sarvam API Key found.");
      return;
    }

    const targetLangCode = langCode || language || "en-IN";

    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      const requestBody = {
        inputs: [text.substring(0, 1000)], // Enforce length limits if any
        speaker: "priya",
        target_language_code: targetLangCode,
        model: "bulbul:v3"
      };

      const response = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`TTS API failed: ${errText}`);
      }

      const data = await response.json();
      const audioBase64 = data.audio_content || data.audios?.[0];

      if (audioBase64) {
        const audioSrc = `data:audio/wav;base64,${audioBase64}`;
        if (!audioRef.current) {
          audioRef.current = new Audio(audioSrc);
        } else {
          audioRef.current.src = audioSrc;
        }
        await audioRef.current.play();
      }
    } catch (e) {
      console.error("Sarvam TTS error", e);
      // Fallback to basic window speech synth if Bulbul fails
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = targetLangCode;
        window.speechSynthesis.speak(utterance);
      } catch (err) { }
    }
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
    return { severity: null, advice: raw, callHospital: false, summary: "", languageCode: null };
  };

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = async (overrideInput = null, detectedLanguage = null) => {
    const textToSend = typeof overrideInput === "string" ? overrideInput.trim() : input.trim();
    if (!textToSend || isTyping) return;

    const userMsg = { id: Date.now(), role: "user", content: textToSend, severity: null };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setError(null);
    try {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch (e) { console.error("Audio sync error", e); }

    let activeLanguage = detectedLanguage || language;

    // ── Offline Fallback ──
    if (!navigator.onLine) {
      console.log("App is offline, checking local knowledge...");
      const lowerInput = textToSend.toLowerCase();
      const match = OFFLINE_EMERGENCY_DATA.find(item =>
        item.keywords.some(kw => lowerInput.includes(kw.toLowerCase()))
      );

      if (match) {
        const botMsg = {
          id: Date.now() + 1,
          role: "bot",
          content: `${match.advice}\n\n*(Note: This information is from local offline storage.)*`,
          severity: match.severity,
          summary: match.summary,
        };
        setMessages((prev) => [...prev, botMsg]);
        setCurrentSeverity(match.severity);
        setCurrentSummary(match.summary);
        setIsTyping(false);
        try {
          await speakWithBulbul(match.advice, activeLanguage);
        } catch (e) { console.error("Speak error", e); }
        return;
      } else {
        // No match found while offline
        const botMsg = {
          id: Date.now() + 1,
          role: "bot",
          content: "I am currently offline and couldn't find a match for your symptoms in my local database. Please call **112** immediately for any medical emergency.",
          severity: "CRITICAL",
        };
        setMessages((prev) => [...prev, botMsg]);
        setCurrentSeverity("CRITICAL");
        setIsTyping(false);
        return;
      }
    }

    try {
      const prompt = `User says: ${textToSend}`;

      // Live AI Logic
      const currentModel = getGenerativeModel();
      
      // If chat session is lost, re-init
      if (!chatRef.current) {
        chatRef.current = currentModel.startChat({ history: [] });
      }

      // Gemini history MUST start with a 'user' message. 
      // Filter out system/welcome messages and find the first user message.
      const rawHistory = messages
        .filter(m => m.content && !m.content.includes("Hello! I'm Sahayaka AI")) // Skip welcome
        .map(m => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));

      const result = await chatRef.current.sendMessage(textToSend);
      const rawText = result.response.text();

      const parsed = parseAIResponse(rawText);
      const { severity, advice, callHospital, summary, languageCode } = parsed;

      if (languageCode) {
        activeLanguage = languageCode;
        const matchedLang = LANGUAGES.find(l => l.code === languageCode);
        if (matchedLang) setLanguage(languageCode);
      }

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
        await speakWithBulbul(advice, activeLanguage);
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

  const handleTranscribe = async (audioBlob) => {
    setIsTyping(true);
    const apiKey = import.meta.env.VITE_SARVAM_API_KEY;
    if (!apiKey) {
      setError("Sarvam API key not found");
      setIsTyping(false);
      return;
    }

    const formData = new FormData();
    // Use the actual mime type to determine extension
    const extension = audioBlob.type.includes('webm') ? 'webm' : 'wav';
    formData.append("file", audioBlob, `audio.${extension}`);
    formData.append("model", "saaras:v1");
    formData.append("language_code", "unknown");

    try {
      console.log("Sending to Sarvam:", { size: audioBlob.size, type: audioBlob.type, extension });
      
      const response = await fetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey
        },
        body: formData
      });

      const data = await response.json();
      console.log("Sarvam API Response Data:", data);

      if (response.ok) {
        const transcript = data.transcript || data.transcript_text;
        if (transcript) {
          let detectedLang = language;
          if (data.language_code) {
            const matchedLang = LANGUAGES.find(l => l.code === data.language_code);
            if (matchedLang) {
              setLanguage(data.language_code);
              detectedLang = data.language_code;
            }
          }

          setInput(transcript);
          handleSend(transcript, detectedLang);
        } else {
          throw new Error("No transcript returned from AI.");
        }
      } else {
        // Detailed error extraction
        let detail = "";
        if (data.detail) {
           detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } else if (data.message) {
           detail = data.message;
        } else {
           detail = JSON.stringify(data);
        }
        throw new Error(`Sarvam Error (${response.status}): ${detail}`);
      }
    } catch (err) {
      console.error("Saaras API Error:", err);
      setError(err.message);
      setIsTyping(false);
    }
  };

  // ── Mic toggle ────────────────────────────────────────────────────────
  const toggleMic = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      // Check for Secure Context (Required for getUserMedia in browsers)
      if (!window.isSecureContext && !Capacitor.isNativePlatform()) {
        setError("Microphone requires a secure connection (HTTPS or localhost). If testing on a phone, use the APK or an HTTPS tunnel.");
        return;
      }

      // For APK: Explicitly request native microphone permissions
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await CapacitorSpeech.checkPermissions();
          if (perm.speechRecognition !== "granted") {
            const req = await CapacitorSpeech.requestPermissions();
            if (req.speechRecognition !== "granted") {
              setError("Microphone permission denied.");
              return;
            }
          }
        } catch (permErr) {
          console.warn("Permission check failed, proceeding with getUserMedia:", permErr);
        }
      }

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        setError("Microphone not supported on this device/browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine best supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
        
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // Prevent sending tiny/empty files
        if (audioBlob.size < 500) {
           console.warn("Recording too short, ignoring.");
           return;
        }

        // Use correct extension for the blob
        await handleTranscribe(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setInput("");
      setIsListening(true);
      setError(null);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setIsListening(false);
      setError("Microphone access denied or not available.");
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
            className={`chat-action-btn chat-mic-btn ${isListening ? "listening pulsing" : ""}`}
            onClick={toggleMic}
            title={isListening ? "Stop and Transcribe" : "Start Voice Input"}
          >
            {isListening ? <Square size={22} fill="var(--primary)" /> : <Mic size={22} />}
          </button>

          <input
            className="chat-input"
            type="text"
            placeholder={isListening ? "Listening... Click mic to stop" : isTyping ? "Transcribing..." : "Describe symptoms..."}
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
