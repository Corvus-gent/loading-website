export async function sendCode(email, code) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.LOGIN_FROM || "corvus <login@corvus.gent>",
      to: [email],
      subject: `${code} is your corvus.gent code`,
      text: `Your code: ${code}\n\nValid for 3 minutes. If you didn't ask for this, ignore it.\n\n— the crow`,
    }),
  });
  if (!r.ok) throw new Error("mail failed");
}
