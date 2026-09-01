/**
 * Spoken welcome, played once right after demo login (inside the click
 * gesture, so mobile browsers allow audio). Uses the browser's built-in
 * speech synthesis — no API needed.
 */
const WELCOME_TEMPLATE = (name: string) =>
  `Welcome, ${name}! I'm KT, your learning mentor. Here's how this works: you learn simply by talking to me. ` +
  `Pick any subject you like — math, science, English, history, programming, or anything else you're curious about. ` +
  `Just press start, speak naturally, and ask me anything. I'll explain ideas step by step, with examples, and I'll always go at your pace. ` +
  `I'm excited to learn with you. Let's begin!`;

export function speakWelcome(name: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(WELCOME_TEMPLATE(name));
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    // Prefer a female English voice when available.
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => /en(-|_)?(US|GB)/i.test(v.lang) && /female|samantha|zira|google uk english female|google us english/i.test(v.name))
      ?? window.speechSynthesis.getVoices().find((v) => /en/i.test(v.lang));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech synthesis unavailable — silently skip */
  }
}

export function stopWelcome(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
