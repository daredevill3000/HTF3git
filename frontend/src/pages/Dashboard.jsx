import { useState } from "react";
import { AlertTriangle, MapPin, Clock, Shield, Ambulance, Activity, Users, Phone, Copy, Check } from "lucide-react";

const nearbyServices = [
  {
    id: 1,
    type: "Police",
    name: "Udyambag Police Station",
    distance: "1.2 km",
    eta: "4 min",
    status: "Available",
    icon: Shield,
    color: "#3b82f6",
  },
  {
    id: 2,
    type: "Police",
    name: "Khanapur Outpost",
    distance: "3.5 km",
    eta: "9 min",
    status: "On Patrol",
    icon: Shield,
    color: "#3b82f6",
  },
  {
    id: 3,
    type: "Ambulance",
    name: "City Medical Unit 1",
    distance: "2.1 km",
    eta: "6 min",
    status: "Available",
    icon: Ambulance,
    color: "#ef4444",
  },
  {
    id: 4,
    type: "Ambulance",
    name: "Rapid Response Unit",
    distance: "4.8 km",
    eta: "12 min",
    status: "Standby",
    icon: Ambulance,
    color: "#ef4444",
  },
];

const emergencyContacts = [
  { name: "Police", number: "100", icon: Shield, color: "#3b82f6" },
  { name: "Ambulance", number: "108", icon: Ambulance, color: "#ef4444" },
  { name: "Fire", number: "101", icon: AlertTriangle, color: "#f59e0b" },
  { name: "Women's Helpline", number: "1091", icon: Users, color: "#8b5cf6" },
];

const Dashboard = () => {
  const [copiedId, setCopiedId] = useState(null);

  const activeAlerts = [
    { id: 1, status: "Critical", location: "Gokak Falls", time: "2 mins ago", type: "Flood" },
    { id: 2, status: "Urgent", location: "Khanapur Forest", time: "10 mins ago", type: "Fire" },
    { id: 3, status: "Moderate", location: "Belagavi Highway", time: "22 mins ago", type: "Accident" },
  ];

  const quickActions = [
    { id: 1, label: "Live Location", icon: MapPin, desc: "Share real-time GPS" },
    { id: 2, label: "Call Emergency", icon: Phone, desc: "Instant 112 connection" },
    { id: 3, label: "Trusted Contacts", icon: Users, desc: "Alert family & friends" },
  ];

  const handleCopy = (number, name) => {
    navigator.clipboard.writeText(number);
    setCopiedId(name);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const triggerSOS = () => {
    window.dispatchEvent(new CustomEvent('trigger-sos'));
  };

  return (
    <div className="dashboard-container">
      {/* Large SOS Button Section */}
      <div className="sos-section">
        <button className="sos-button" onClick={triggerSOS}>
          <AlertTriangle size={48} />
          <span>SOS</span>
        </button>
        <div className="sos-info">
          <h1>Instant Emergency Help</h1>
          <p>Press the button above for immediate assistance. Your location and details will be shared with emergency services.</p>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="quick-actions-grid">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <div key={action.id} className="action-card card">
              <div className="action-icon">
                <Icon size={24} />
              </div>
              <div className="action-content">
                <h3>{action.label}</h3>
                <p>{action.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Live Alert Feed */}
        <div className="dashboard-panel">
          <h2>
            <span className="live-dot" aria-hidden="true"></span>
            Emergency Alerts
          </h2>
          <div className="alert-list">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className={`alert-item ${alert.status.toLowerCase()}`}>
                <div className="alert-info">
                  <p className="alert-location">
                    <MapPin size={16} /> {alert.location}
                  </p>
                  <small>
                    <Clock size={12} /> {alert.time} &nbsp;·&nbsp; {alert.type}
                  </small>
                </div>
                <span className="alert-badge">{alert.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contacts Panel */}
        <div className="dashboard-panel">
          <h2>Emergency Contacts</h2>
          <div className="contacts-list">
            {emergencyContacts.map((contact) => {
              const Icon = contact.icon;
              return (
                <div key={contact.name} className="contact-item">
                  <div className="contact-icon-wrapper" style={{ background: `${contact.color}15`, color: contact.color }}>
                    <Icon size={18} />
                  </div>
                  <div className="contact-details">
                    <span className="contact-name">{contact.name}</span>
                    <span className="contact-number">{contact.number}</span>
                  </div>
                  <button
                    className={`copy-btn ${copiedId === contact.name ? 'copied' : ''}`}
                    onClick={() => handleCopy(contact.number, contact.name)}
                    aria-label={`Copy ${contact.name} number`}
                  >
                    {copiedId === contact.name ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nearby Services */}
        <div className="dashboard-panel" style={{ gridColumn: "span 2" }}>
          <h2>Nearby Help</h2>
          <div className="services-list grid-cols-2">
            {nearbyServices.map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.id} className="service-item">
                  <div className="service-icon" style={{ background: `${service.color}15`, color: service.color }}>
                    <Icon size={20} />
                  </div>
                  <div className="service-info">
                    <span className="service-name">{service.name}</span>
                    <span className="service-meta">
                      {service.distance} · {service.eta}
                    </span>
                  </div>
                  <button className="service-call-btn">
                    <Phone size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;