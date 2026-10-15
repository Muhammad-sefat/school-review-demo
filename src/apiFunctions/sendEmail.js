/**
 * Sends early access notification email via serverless Resend integration.
 *
 * @param {Object} params
 * @param {string} params.email - The subscriber's email address
 * @param {string} [params.website] - Honeypot anti-spam field (should be empty)
 * @returns {Promise<{ ok: boolean, data?: any }>}
 */
export async function sendEarlyAccessEmail({ email, website = "" }) {
  const trimmedEmail = (email || "").trim();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  if (!isValidEmail || trimmedEmail.length > 254) {
    throw new Error("Please enter a valid email address.");
  }

  const response = await fetch("/.netlify/functions/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: trimmedEmail,
      website: website || "",
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.error || "Failed to send notification email. Please try again.");
  }

  return result;
}

export default sendEarlyAccessEmail;
