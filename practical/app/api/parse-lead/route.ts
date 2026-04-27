import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { LeadInput } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  let body: { text: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body;
  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a data-extraction assistant. Given a natural language description of a real estate lead, extract structured contact and address information. Always respond with valid JSON only — no markdown, no explanation.`;

  const userPrompt = `Extract the following fields from the text below. If a field cannot be determined, return an empty string for it. Return a single flat JSON object with exactly these keys: name, email, company, address, city, state.

Text:
"""
${text}
"""

Return only the JSON object.`;

  try {
    const message = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 256,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // Strip any accidental markdown fences
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();

    let parsed: Partial<LeadInput>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "Claude returned unparseable JSON", raw }, { status: 502 });
    }

    const lead: LeadInput = {
      name: parsed.name ?? "",
      email: parsed.email ?? "",
      company: parsed.company ?? "",
      address: parsed.address ?? "",
      city: parsed.city ?? "",
      state: parsed.state ?? "",
    };

    return NextResponse.json(lead);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
