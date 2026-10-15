export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { email, website } = body || {};

  // Honeypot: bot hole chup kore ok dekhao, email pathiyo na
  if (website) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
  if (!valid || email.length > 254) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const clientEmail = process.env.CLIENT_EMAIL || "muhammadsefat55@gmail.com";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "SchoolReview <noreply@schoolreview.ch>";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Resend API key is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let res = await fetch("https://api.resend.com/emails", {
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

  let data = await res.json().catch(() => ({}));

  // Fallback to onboarding@resend.dev if custom domain is not yet verified
  if (!res.ok && data?.message?.includes("is not verified")) {
    console.warn("Domain not verified, falling back to onboarding@resend.dev for testing");
    res = await fetch("https://api.resend.com/emails", {
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
    data = await res.json().catch(() => ({}));
  }

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data?.message || "Email failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  path: "/.netlify/functions/send-email",
};
