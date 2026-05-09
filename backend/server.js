const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan");
const path = require('path');
const twilio = require('twilio');

// 1. Load Environment Variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// 2. Middleware
app.use(cors({
  origin: "*", // Allow all origins so the mobile app (file://) can reach the backend
  methods: ["GET", "POST"],
}));
app.use(express.json());
app.use(morgan("dev"));

// 3. Health Check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Backend server is healthy and connected!",
    timestamp: new Date().toISOString(),
  });
});

// 4. Serve frontend static files (built by Vite into frontend/www)
const frontendDist = path.join(__dirname, '..', 'frontend', 'www');
app.use(express.static(frontendDist));

// SPA fallback: for non-API GET requests, serve index.html
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();
  const indexHtml = path.join(frontendDist, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) next(err);
  });
});

// ─── Twilio Client ─────────────────────────────────────────────────────────────
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || accountSid === "your_account_sid_here") {
    throw new Error("TWILIO_ACCOUNT_SID is not configured in .env");
  }
  if (!authToken || authToken === "your_auth_token_here") {
    throw new Error("TWILIO_AUTH_TOKEN is not configured in .env");
  }

  return twilio(accountSid, authToken);
}

// ─── Send SMS via Twilio ───────────────────────────────────────────────────────
async function sendSMS(recipients, variables) {
  const client = getTwilioClient();
  const from   = process.env.TWILIO_PHONE_NUMBER;

  if (!from || from === "your_twilio_number_here") {
    throw new Error("TWILIO_PHONE_NUMBER is not configured in .env");
  }

  const body =
    `SOS! From: ${variables.name}. ` +
    `Location: ${variables.location}. ` +
    `Time: ${variables.time}. ` +
    `Respond immediately! -Sahayaka`;

  const results = [];

  for (const mobile of recipients) {
    // Twilio needs E.164 format: +917090366469
    const to = mobile.startsWith("+") ? mobile : `+${mobile}`;

    try {
      const message = await client.messages.create({ body, from, to });
      console.log(`✅ SMS sent to ${to} — SID: ${message.sid}`);
      results.push({ to, success: true, sid: message.sid });
    } catch (err) {
      console.error(`❌ SMS failed for ${to}:`, err.message);
      results.push({ to, success: false, error: err.message });
    }
  }

  const anySuccess = results.some((r) => r.success);
  if (!anySuccess) throw new Error("All SMS failed: " + JSON.stringify(results));

  return { type: "success", channel: "sms", results };
}

// ─── POST /api/sos ─────────────────────────────────────────────────────────────
app.post("/api/sos", async (req, res) => {
  const { name, location, coordinates, extraContacts = [] } = req.body;

  if (!name || !location) {
    return res.status(400).json({ success: false, error: "name and location are required" });
  }

  const envContacts = (process.env.EMERGENCY_CONTACTS || "")
    .split(",").map((n) => n.trim()).filter(Boolean);

  const allRecipients = [...new Set([...envContacts, ...extraContacts])];

  if (allRecipients.length === 0) {
    return res.status(400).json({ success: false, error: "No EMERGENCY_CONTACTS in .env" });
  }

  const variables = {
    name,
    location,
    coordinates: coordinates || "Not available",
    time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  };

  console.log(`\n🚨 SOS TRIGGERED`);
  console.log(`   Name:       ${name}`);
  console.log(`   Location:   ${location}`);
  console.log(`   Recipients: ${allRecipients.join(", ")}`);
  console.log(`   Time:       ${variables.time}\n`);

  try {
    const result = await sendSMS(allRecipients, variables);
    console.log("✅ Result:", JSON.stringify(result, null, 2));
    return res.status(200).json({
      success: true,
      message: `SOS SMS sent to ${allRecipients.length} contact(s)`,
      recipients: allRecipients.length,
      result,
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/sos/test ────────────────────────────────────────────────────────
app.post("/api/sos/test", async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ success: false, error: "mobile is required" });

  try {
    const result = await sendSMS([mobile], {
      name: "Test User",
      location: "Gokak Falls, Karnataka",
      coordinates: "15.3173,75.7139",
      time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    });
    return res.status(200).json({ success: true, message: `Test SMS sent to ${mobile}`, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 5. Start Server
app.listen(PORT, HOST, () => {
  console.log(`
     Server is screaming live!
     URL: http://localhost:${PORT}
     Mode: ${process.env.NODE_ENV || "development"}
    `);
});