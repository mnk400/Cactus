const log = {
  info: (message, meta = {}) =>
    console.log(
      JSON.stringify({
        level: "info",
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      }),
    ),
  error: (message, meta = {}) =>
    console.error(
      JSON.stringify({
        level: "error",
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      }),
    ),
};

const DEFAULT_PROMPT =
  "...";

const VIDEO_PREFIX = "These are frames from a video. ";

const DEFAULT_BLOCKLIST = [
  "woman",
  "man",
  "person",
  "photograph",
  "photo",
  "image",
  "picture",
  "outdoor",
  "indoor",
  "male",
  "female",
  "human",
  "people",
  "girl",
  "boy",
  "video",
  "frame",
  "screenshot",
  "still",
];

class AutoTagService {
  constructor({ baseUrl = "http://127.0.0.1:8080", prompt, blocklist }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.ready = false;
    this._pollInterval = null;
    this.prompt = prompt || DEFAULT_PROMPT;
    this.blocklist = new Set(
      (blocklist || DEFAULT_BLOCKLIST).map((w) => w.toLowerCase()),
    );
  }

  startPolling() {
    this._checkHealth();
    this._pollInterval = setInterval(() => this._checkHealth(), 10000);
  }

  stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  async _checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const wasReady = this.ready;
        this.ready = data.status === "ok";
        if (this.ready && !wasReady) {
          log.info("Auto-tag service is ready", { baseUrl: this.baseUrl });
        }
      } else {
        this.ready = false;
      }
    } catch {
      if (this.ready) {
        log.error("Auto-tag service became unreachable", {
          baseUrl: this.baseUrl,
        });
      }
      this.ready = false;
    }
  }

  /**
   * Generate tags from a single image buffer.
   */
  async generateTagsFromBuffer(imageBuffer, mime = "image/jpeg") {
    return this.generateTagsFromBuffers([{ buffer: imageBuffer, mime }]);
  }

  /**
   * Generate tags from one or more image buffers.
   * Each entry: { buffer: Buffer, mime: string }
   */
  async generateTagsFromBuffers(images) {
    if (!this.ready) {
      throw new Error("Auto-tag service is not reachable");
    }

    const isMulti = images.length > 1;
    const prompt = isMulti ? VIDEO_PREFIX + this.prompt : this.prompt;

    const content = images.map(({ buffer, mime }) => ({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${buffer.toString("base64")}` },
    }));
    content.push({ type: "text", text: prompt });

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "joycaption",
        messages: [{ role: "user", content }],
        max_tokens: 256,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`llama-server returned ${res.status}: ${text}`);
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content || "";
    return this._postProcess(rawText);
  }

  _postProcess(rawText) {
    const tags = rawText
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/_/g, " "))
      .map((t) =>
        t
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      )
      .filter((t) => t.length > 0)
      .filter((t) => {
        const words = t.split(/\s+/);
        return words.length >= 1 && words.length <= 3;
      })
      .filter((t) => !this.blocklist.has(t.toLowerCase()));

    return [...new Set(tags)];
  }
}

module.exports = AutoTagService;
