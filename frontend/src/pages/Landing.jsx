import { Link } from "react-router-dom";
import { ArrowRight, Globe, Zap, Shield } from "lucide-react"; // Premium icons

const Landing = () => {
  return (
    <div className="container" style={{ paddingTop: "12vh", textAlign: "center" }}>
      <header className="hero-section" style={{ marginBottom: "80px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "100px",
            background: "rgba(230, 57, 70, 0.05)",
            fontSize: "0.85rem",
            fontWeight: "600",
            color: "var(--primary)",
            marginBottom: "32px",
            border: "1px solid rgba(230, 57, 70, 0.1)"
          }}
        >
          <Shield size={14} /> Mission Critical Safety
        </div>

        <h1
          style={{
            fontSize: "4.5rem",
            fontWeight: "900",
            lineHeight: "1",
            marginBottom: "24px",
            letterSpacing: "-0.04em"
          }}
        >
          Safety at <span style={{ color: "var(--primary)" }}>One Tap</span>.
        </h1>
        <p
          style={{
            maxWidth: "650px",
            margin: "0 auto 48px auto",
            fontSize: "1.25rem",
            color: "var(--accents-3)",
            lineHeight: "1.6"
          }}
        >
          Bridging the emergency communication gap in remote India with
          real-time AI triage and instant SOS response.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <Link to="/dashboard">
            <button
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "10px", 
                padding: "1rem 2.5rem",
                fontSize: "1.1rem"
              }}
            >
              Get Started <ArrowRight size={20} />
            </button>
          </Link>

          <button className="secondary-btn" style={{ padding: "1rem 2.5rem", fontSize: "1.1rem" }}>
            Learn More
          </button>
        </div>
      </header>

      {/* Features */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          marginTop: "100px",
          paddingBottom: "100px"
        }}
      >
        <div className="card">
          <div className="action-icon" style={{ marginBottom: "20px" }}>
            <Globe size={28} />
          </div>
          <h3 style={{ fontSize: "1.5rem", marginBottom: "12px" }}>Multilingual AI</h3>
          <p>Report emergencies in your native language. Our AI understands Kannada, Hindi, Marathi, and more.</p>
        </div>
        <div className="card">
          <div className="action-icon" style={{ marginBottom: "20px" }}>
            <Zap size={28} />
          </div>
          <h3 style={{ fontSize: "1.5rem", marginBottom: "12px" }}>Offline First</h3>
          <p>Works in low-connectivity "dead zones". Critical alerts are prioritized and synced automatically.</p>
        </div>
      </section>
    </div>
  );
};

export default Landing;
