export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
  }

  const { email, website } = body || {};

  // Honeypot: bot check (silent success, no email sent)
  if (website) {
    return res.status(200).json({ ok: true });
  }

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
  if (!valid || email.length > 254) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const clientEmail = process.env.CLIENT_EMAIL || "muhammadsefat55@gmail.com";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "SchoolReview <noreply@schoolreview.ch>";

  if (!apiKey) {
    return res.status(500).json({ error: "Resend API key is not configured" });
  }

  try {
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
      return res.status(502).json({ error: data?.message || "Email failed" });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
