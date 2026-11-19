import type { FeedbackForm } from './schema';

export default {
  "slug": "hackers-bay",
  "title": "The Hackers Bay — 1-minute feedback",
  "subtitle": "Takes 30–60 seconds. Thank you!",
  "emailSubject": "New Hackers Bay feedback",
  "introHtml": "<div style=\"font-size:15px;color:var(--ink);font-weight:600;margin-bottom:6px\">An event platform where you RSVP to people, not places.</div>\n  Luma shows you a wall of faces. We show you <b>the 3 people in that room you should actually meet — and why</b>.<br><br>\n  <b>How it works:</b> open an invite → paste one link (X, GitHub or LinkedIn) → we build your profile in seconds → you see your 3 matches with a reason for each → if both of you say yes, the intro unlocks with a time and place (“20:15 at the bar”).<br><br>\n  <span class=\"pill\">boat hackathon</span> Built by Gabe, Siebe &amp; Colin. We'd love your honest take.",
  "minutes": 1,
  "sections": [
    {
      "id": "o_thumbs",
      "title": "Quick gut check"
    },
    {
      "id": "o_open",
      "title": "Your words"
    }
  ],
  "questions": [
    {
      "id": "u_luma",
      "section": "o_thumbs",
      "label": "I'd use this instead of scrolling a Luma guest list",
      "type": "thumbs",
      "placeholder": "Feedback, a change, why…"
    },
    {
      "id": "u_link",
      "section": "o_thumbs",
      "label": "I'd paste my LinkedIn / X / GitHub to get matched",
      "type": "thumbs",
      "placeholder": "Feedback, a change, why…"
    },
    {
      "id": "u_why",
      "section": "o_thumbs",
      "label": "Knowing WHY I should meet someone matters more than WHO they are",
      "type": "thumbs",
      "placeholder": "Feedback, a change, why…"
    },
    {
      "id": "u_run",
      "section": "o_thumbs",
      "label": "Seeing a live demo of what someone built (we run their code) would make me want to meet them",
      "type": "thumbs",
      "placeholder": "Feedback, a change, why…"
    },
    {
      "id": "u_pain",
      "section": "o_open",
      "label": "What's the most annoying part of going to events today?",
      "type": "text",
      "placeholder": "Your answer…"
    },
    {
      "id": "u_creepy",
      "section": "o_open",
      "label": "What would make this feel creepy — and what would make it feel safe?",
      "type": "text",
      "placeholder": "Your answer…"
    },
    {
      "id": "u_meet",
      "section": "o_open",
      "label": "Who would you want to meet at your next event?",
      "type": "text",
      "placeholder": "Your answer…"
    },
    {
      "id": "u_else",
      "section": "o_open",
      "label": "Anything else? (Leave your name or handle if you'd like us to follow up.)",
      "type": "text",
      "placeholder": "Your answer…"
    }
  ]
} satisfies FeedbackForm;
