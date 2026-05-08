import { useState, useEffect, useRef } from "react";
import { AlertTriangle, MapPin, Phone, Ambulance, Shield, CheckCircle, X, Radio } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Geolocation } from "@capacitor/geolocation";

const nearbyServices = [
  { id: 1, type: "Police",    name: "Gokak Police Station", distance: "1.2 km", eta: "4 min",  phone: "+91-8352-220100", icon: Shield,    color: "#3b82f6" },
  { id: 2, type: "Police",    name: "Khanapur Outpost",     distance: "3.5 km", eta: "9 min",  phone: "+91-8352-220200", icon: Shield,    color: "#3b82f6" },
  { id: 3, type: "Ambulance", name: "City Medical Unit 1",  distance: "2.1 km", eta: "6 min",  phone: "108",             icon: Ambulance, color: "#ef4444" },
  { id: 4, type: "Ambulance", name: "Rapid Response Unit",  distance: "4.8 km", eta: "12 min", phone: "102",             icon: Ambulance, color: "#ef4444" },
];

const SOS_SEQUENCE = [
  { id: 1, message: "🚨 SOS Signal Transmitted",         detail: "Broadcasting emergency alert to all nearby units...", delay: 0    },
  { id: 2, message: "📡 Location Shared",                detail: "GPS coordinates sent to emergency services",          delay: 1200 },
  { id: 3, message: "🚔 Police Notified",                detail: "Gokak Police Station & Khanapur Outpost alerted",     delay: 2400 },
  { id: 4, message: "🚑 Ambulance Dispatched",           detail: "City Medical Unit 1 en route — ETA 6 minutes",        delay: 3800 },
  { id: 5, message: "📞 Emergency Coordinator Connected",detail: "Central command monitoring your situation",            delay: 5200 },
  { id: 6, message: "✅ All Units Confirmed",            detail: "Help is on the way. Stay calm and stay safe.",         delay: 6800 },
];

const EmergencyButton = () => {
  const [sosActive, setSosActive]           = useState(false);
  const [sosNotifications, setSosNotifications] = useState([]);
  const [sosComplete, setSosComplete]       = useState(false);
  const [smsStatus, setSmsStatus]           = useState(null);
  const [location, setLocation]             = useState({ label: "Locating...", coords: null });
  const [locationReady, setLocationReady]   = useState(false);
  const locationRef                         = useRef({ label: "Locating...", coords: null });
  const { user } = useAuth();

  // Reverse geocode coords → human-readable address
  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (data && data.display_name) {
        // Shorten: take first 3 parts (e.g. "Gokak, Belagavi, Karnataka")
        const parts = data.display_name.split(",").slice(0, 3).map(s => s.trim());
        return parts.join(", ");
      }
    } catch (e) {
      console.warn("Reverse geocode failed:", e.message);
    }
    return null;
  };

  // Grab GPS on mount — keep refreshing until we get a fix
  useEffect(() => {
    const getLocation = async () => {
      const applyCoords = async (latitude, longitude) => {
        const coords = `${latitude},${longitude}`;
        const coordLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        // Set coords immediately so SOS can fire right away
        const immediate = { label: coordLabel, coords };
        setLocation(immediate);
        locationRef.current = immediate;
        setLocationReady(true);

        // Then try to get a human-readable address in the background
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          const withAddress = { label: address, coords };
          setLocation(withAddress);
          locationRef.current = withAddress;
        }
      };

      try {
        const permission = await Geolocation.requestPermissions();
        if (permission.location === "granted" || permission.coarseLocation === "granted") {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
          await applyCoords(pos.coords.latitude, pos.coords.longitude);
          return;
        }
      } catch (err) {
        console.warn("Capacitor GPS failed, trying browser fallback:", err.message);
      }

      // Browser geolocation fallback
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await applyCoords(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            console.error("GPS failed:", err.message);
            const fallback = { label: "Location unavailable", coords: null };
            setLocation(fallback);
            locationRef.current = fallback;
            setLocationReady(true);
          },
          { enableHighAccuracy: true, timeout: 15000 }
        );
      } else {
        const fallback = { label: "Location unavailable", coords: null };
        setLocation(fallback);
        locationRef.current = fallback;
        setLocationReady(true);
      }
    };
    getLocation();
  }, []);

  // ── Send SMS directly via Twilio REST API ────────────────────────────
  const sendSOSSms = async (currentLocation) => {
    setSmsStatus("sending");

    const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken  = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const fromNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;
    const contacts   = (import.meta.env.VITE_EMERGENCY_CONTACTS || "").split(",").map(n => n.trim()).filter(Boolean);

    if (!accountSid || !authToken || !fromNumber || contacts.length === 0) {
      console.error("❌ Twilio env vars missing");
      setSmsStatus("failed");
      return;
    }

    // Keep under 160 chars for Twilio trial account limit
    const mapLink = currentLocation.coords
      ? `maps.google.com/?q=${currentLocation.coords}`
      : null;
    const time = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
    const name = (user?.email || "User").split("@")[0];

    let body = `SOS! ${name} needs help. ${currentLocation.label}.`;
    if (mapLink) body += ` ${mapLink}.`;
    body += ` Time: ${time}. -Sahayaka`;

    // Trim to 155 chars if still too long (safety margin)
    if (body.length > 155) {
      body = `SOS! ${name} needs help. ${mapLink || currentLocation.label}. Time: ${time}. -Sahayaka`;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    let anySuccess = false;

    for (const contact of contacts) {
      const to = contact.startsWith("+") ? contact : `+${contact}`;
      try {
        const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });
        const data = await res.json();
        if (res.ok && data.sid) {
          console.log(`✅ SMS sent to ${to} — SID: ${data.sid}`);
          anySuccess = true;
        } else {
          console.error(`❌ SMS failed for ${to}:`, data.message || data);
        }
      } catch (err) {
        console.error(`❌ SMS error for ${to}:`, err.message);
      }
    }

    setSmsStatus(anySuccess ? "sent" : "failed");
  };

  // ── Listen for trigger-sos event from Dashboard SOS button ───────────
  useEffect(() => {
    const handler = () => triggerSOS();
    window.addEventListener("trigger-sos", handler);
    return () => window.removeEventListener("trigger-sos", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trigger SOS ───────────────────────────────────────────────────────
  const triggerSOS = () => {
    setSosActive(true);
    setSosNotifications([]);
    setSosComplete(false);
    setSmsStatus(null);

    // Use ref to always get the latest location value
    sendSOSSms(locationRef.current);

    // Run UI notification sequence
    SOS_SEQUENCE.forEach((step) => {
      setTimeout(() => {
        setSosNotifications((prev) => [...prev, step]);
        if (step.id === SOS_SEQUENCE.length) setSosComplete(true);
      }, step.delay);
    });
  };

  const closeSOS = () => {
    setSosActive(false);
    setSosNotifications([]);
    setSosComplete(false);
    setSmsStatus(null);
  };

  const callService = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <>
      {/* Floating Emergency Button */}
     

      {/* SOS Modal Overlay */}
      {sosActive && (
        <div className="sos-overlay" role="dialog" aria-modal="true" aria-label="Emergency SOS Status">
          <div className="sos-modal">

            {/* Header */}
            <div className="sos-modal-header">
              <div className="sos-pulse-ring" aria-hidden="true">
                <AlertTriangle size={32} />
              </div>
              <h2>Emergency SOS Active</h2>
              <p>Broadcasting your location to all nearby units</p>

              {/* SMS status badge */}
              <div className={`sms-status-badge sms-${smsStatus || "idle"}`}>
                {smsStatus === "sending" && <><span className="sms-dot"></span> Sending SMS alerts...</>}
                {smsStatus === "sent"    && <><CheckCircle size={13} /> SMS alerts delivered</>}
                {smsStatus === "failed"  && <>⚠ SMS failed — check backend</>}
              </div>

              {/* Location row */}
              <div className="sos-location-row">
                <MapPin size={13} />
                <span>{location.label}</span>
              </div>

              {!sosComplete && (
                <button className="sos-close-btn" onClick={closeSOS} aria-label="Close">
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Notification sequence */}
            <div className="sos-notifications">
              {sosNotifications.map((notif) => (
                <div key={notif.id} className="sos-notif-item">
                  <CheckCircle size={18} className="notif-check" />
                  <div>
                    <p className="notif-message">{notif.message}</p>
                    <small className="notif-detail">{notif.detail}</small>
                  </div>
                </div>
              ))}
              {!sosComplete && sosNotifications.length < SOS_SEQUENCE.length && (
                <div className="sos-loading">
                  <span className="loading-dot"></span>
                  <span className="loading-dot"></span>
                  <span className="loading-dot"></span>
                </div>
              )}
            </div>

            {/* Completion state */}
            {sosComplete && (
              <>
                <div className="sos-complete">
                  <p>All units have been notified. Help is on the way.</p>
                </div>

                <div className="services-contacted">
                  <h3><Radio size={16} /> Services Contacted</h3>
                  <div className="contacted-list">
                    {nearbyServices.map((service) => {
                      const Icon = service.icon;
                      return (
                        <div key={service.id} className="contacted-item">
                          <div className="contacted-icon" style={{ background: `${service.color}22`, color: service.color }}>
                            <Icon size={16} />
                          </div>
                          <div className="contacted-info">
                            <span className="contacted-name">{service.name}</span>
                            <span className="contacted-meta">
                              <MapPin size={10} /> {service.distance} · ETA {service.eta}
                            </span>
                          </div>
                          <button className="call-btn-small" onClick={() => callService(service.phone)} title={`Call ${service.name}`}>
                            <Phone size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="sos-actions">
                  <button className="sos-call-btn" onClick={() => callService("112")}>
                    <Phone size={16} /> Call Emergency (112)
                  </button>
                  <button className="sos-dismiss-btn" onClick={closeSOS}>
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default EmergencyButton;