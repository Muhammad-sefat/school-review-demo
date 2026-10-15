import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "dev-server-send-email",
        configureServer(server) {
          server.middlewares.use("/.netlify/functions/send-email", async (req, res, next) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });

            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body || "{}");
                const { email, website } = parsed;

                // Honeypot: bot check
                if (website) {
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: true }));
                  return;
                }

                const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
                if (!valid || email.length > 254) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "Invalid email" }));
                  return;
                }

                const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
                const clientEmail = env.CLIENT_EMAIL || process.env.CLIENT_EMAIL || "muhammadsefat55@gmail.com";
                const fromEmail = env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "SchoolReview <noreply@schoolreview.ch>";

                if (!apiKey) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "Resend API key is not configured" }));
                  return;
                }

                let emailRes = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: fromEmail,
                    to: [clientEmail],
                    subject: "New early access signup",
                    text: `New signup email: ${email}`,
                    html: `<div style="font-family:sans-serif;line-height:1.6;color:#333;">
                      <h2>New Early Access Signup</h2>
                      <p>A new user has requested early access to <strong>SchoolReview</strong>:</p>
                      <p style="font-size:16px;background:#f3f4f6;padding:12px;border-radius:8px;display:inline-block;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                      <p style="font-size:12px;color:#888;margin-top:20px;">Received via SchoolReview early access signup form.</p>
                    </div>`,
                  }),
                });

                let data = await emailRes.json().catch(() => ({}));

                // Fallback to onboarding@resend.dev if custom domain is not yet verified
                if (!emailRes.ok && data?.message?.includes("is not verified")) {
                  console.warn("Domain not verified, falling back to onboarding@resend.dev for testing");
                  emailRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      from: "SchoolReview <onboarding@resend.dev>",
                      to: [clientEmail],
                      subject: "New early access signup",
                      text: `New signup email: ${email}`,
                      html: `<div style="font-family:sans-serif;line-height:1.6;color:#333;">
                        <h2>New Early Access Signup</h2>
                        <p>A new user has requested early access to <strong>SchoolReview</strong>:</p>
                        <p style="font-size:16px;background:#f3f4f6;padding:12px;border-radius:8px;display:inline-block;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                        <p style="font-size:12px;color:#888;margin-top:20px;">Received via SchoolReview early access signup form.</p>
                      </div>`,
                    }),
                  });
                  data = await emailRes.json().catch(() => ({}));
                }

                if (!emailRes.ok) {
                  res.statusCode = 502;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: data?.message || "Email failed" }));
                  return;
                }

                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, data }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
