// /api/verbale.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 🔑 imposta su Vercel
});

// --------- RENDERER: trasforma la "card" in un verbale professionale (Markdown)
function renderProfessionalMinutes(card) {
  const A = (x) => (Array.isArray(x) ? x : []);
  const S = (x) => (x ?? "").toString().trim();

  const attendees = A(card.attendees)
    .map(a => `- **${S(a.name)}** (${S(a.role)}${a.org ? ", " + S(a.org) : ""}) ${a.present === false ? "— assente" : ""}`)
    .join("\n") || "- —";

  const agenda = A(card.agenda)
    .map((v, i) => `${i + 1}. ${S(v)}`)
    .join("\n") || "—";

  const discussion = A(card.discussion)
    .map((d, i) => `**${i + 1}. ${S(d.topic)}**\n${S(d.summary)}`)
    .join("\n\n") || "—";

  const decisions = A(card.decisions)
    .map(d => `- **${S(d.id) || "DEC"}**: ${S(d.text)}${d.rationale ? ` _(Motivazione: ${S(d.rationale)})_` : ""}`)
    .join("\n") || "- —";

  const actions = A(card.actions)
    .map(a => {
      const due = a.due ? ` (scadenza: ${S(a.due)})` : "";
      const pri = a.priority ? ` [${S(a.priority)}]` : "";
      const st  = a.status ? ` — _${S(a.status)}_` : "";
      return `- **${S(a.id) || "AZ"}**: ${S(a.task)} — _Owner: ${S(a.owner)}_${due}${pri}${st}`;
    })
    .join("\n") || "- —";

  const risks = A(card.risks)
    .map(r => `- **Rischio**: ${S(r.risk)}. **Mitigazione**: ${S(r.mitigation)}`)
    .join("\n") || "- —";

  const nextm = card.next_meeting || {};
  const nextAgenda = A(nextm.tentative_agenda)
    .map((v, i) => `${i + 1}. ${S(v)}`)
    .join("\n") || "—";

  return `# ${S(card.meeting?.title || "Verbale di riunione")}

**Data:** ${S(card.meeting?.date)}  
**Orario:** ${S(card.meeting?.time)}  
**Luogo:** ${S(card.meeting?.location)}  
**Redatto da:** ${S(card.meeting?.recorder)}

---

## Partecipanti
${attendees}

---

## Ordine del giorno
${agenda}

---

## Sintesi discussioni
${discussion}

---

## Decisioni prese
${decisions}

---

## Azioni e responsabilità
${actions}

---

## Rischi e mitigazioni
${risks}

---

## Prossimo incontro
- **Data:** ${S(nextm.date)}
- **Orario:** ${S(nextm.time)}
- **Luogo:** ${S(nextm.place)}

**Agenda provvisoria**
${nextAgenda}

---

## Note integrative
${S(card.notes) || "—"}
`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { notes, metadati = {} } = req.body || {};
    if (!notes || notes.trim().length === 0) {
      return res.status(400).json({ message: "Appunti mancanti" });
    }

    // 1) ESTRAZIONE STRUTTURATA IN JSON
    const system =
      "Sei un assistente per verbali professionali. Leggi gli appunti " +
      "e restituisci SOLO JSON valido (in italiano) conforme allo schema fornito.";

    const schema = {
      meeting: {
        title: "string",
        date: "string",      // es. 2025-03-04
        time: "string",      // es. 10:00-11:30
        location: "string",
        recorder: "string"
      },
      attendees: [
        // { name, role, org, present: true/false }
      ],
      agenda: [
        // string
      ],
      discussion: [
        // { topic, summary }
      ],
      decisions: [
        // { id, text, rationale }
      ],
      actions: [
        // { id, owner, task, due, priority, status }
      ],
      risks: [
        // { risk, mitigation }
      ],
      next_meeting: {
        date: "string",
        time: "string",
        place: "string",
        tentative_agenda: []
      },
      notes: "string"
    };

    const extraction = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "Schema JSON:\n" +
            JSON.stringify(schema, null, 2) +
            "\n\nAppunti (in italiano):\n" +
            notes
        }
      ],
    });

    let card;
    try {
      card = JSON.parse(extraction.choices?.[0]?.message?.content || "{}");
    } catch {
      card = {};
    }

    // Fallback/meta merge
    card.meeting = {
      title: metadati?.title || card.meeting?.title || "Verbale di riunione",
      date: card.meeting?.date || metadati?.date || "",
      time: card.meeting?.time || metadati?.time || "",
      location: card.meeting?.location || metadati?.location || "",
      recorder: card.meeting?.recorder || metadati?.recorder || ""
    };

    // 2) RENDER PROFESSIONALE (Markdown)
    const markdown = renderProfessionalMinutes(card);

    // Retro-compatibilità: il front-end legge `verbale`
    return res.status(200).json({
      verbale: markdown,
      markdown,
      card
    });

  } catch (error) {
    console.error("Errore API verbale:", error);
    return res.status(500).json({ message: "Errore interno", error: error.message });
  }
}
