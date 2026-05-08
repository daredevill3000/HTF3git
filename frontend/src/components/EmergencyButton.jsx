import { useState, useEffect } from "react";
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
  const [smsStatus, setSmsStatus]           = useState(null); // "sending" | "sent" | "failed"
  const [location, setLocation]             = useState({ label: "Locating...", coords: null });
  const { user } = useAuth();

  // Grab GPS on mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        // Request permission (required on Android with Capacitor)
        const permission = await Geolocation.requestPermissions();
        if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
          setLocation({ label: "Location permission denied", coords: null });
          return;
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        const { latitude, longitude } = pos.coords;
        setLocation({
          label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          coords: `${latitude},${longitude}`,
        });
      } catch (err) {
        console.error("Geolocation error:", err);
        setLocation({ label: "Location unavailable", coords: null });
      }
    };
    getLocation();
  }, []);

  // ── Send SMS via backend ──────────────────────────────────────────────
  const sendSOSSms = async () => {
    setSmsStatus("sending");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        user?.email || "Emergency User",
          location:    location.label,
          coordinates: location.coords,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSmsStatus("sent");
        console.log("✅ SMS sent:", data);
      } else {
        setSmsStatus("failed");
        console.error("❌ SMS failed:", data.error);
      }
    } catch (err) {
      setSmsStatus("failed");
      console.error("❌ SMS request error:", err.message);
    }
  };

  // ── Trigger SOS ───────────────────────────────────────────────────────
  const triggerSOS = () => {
    setSosActive(true);
    setSosNotifications([]);
    setSosComplete(false);
    setSmsStatus(null);

    // Fire SMS immediately in background
    sendSOSSms();

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
      <button
        className="floating-emergency-btn"
        onClick={triggerSOS}
        aria-label="Emergency SOS"
        title="Emergency SOS"
      >
        <AlertTriangle size={24} />
      </button>

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