/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The full catalog of AI model portals a user can pin to the homepage. `UserSettings`
// stores only an ordered list of ids (`aiPortalIds`) — this is the single source of
// truth for everything else about a portal (URL, tag, description), shared between the
// settings drawer's picker and SearchConsole's rendered tiles.
export interface AiPortal {
  id: string;
  name: string;
  url: string;
  desc: string;
  tag: string;
}

export const ALL_AI_PORTALS: AiPortal[] = [
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com",
    desc: "Google Synapse",
    tag: "GOOGLE",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com",
    desc: "OpenAI Core",
    tag: "OPENAI",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    desc: "Anthropic Hub",
    tag: "ANTHROPIC",
  },
  {
    id: "qwen",
    name: "Qwen",
    url: "https://chat.qwen.ai",
    desc: "Neural Matrix",
    tag: "ALIBABA",
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://www.kimi.com",
    desc: "Moonshot AI",
    tag: "MOONSHOT",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    desc: "DeepSeek Core",
    tag: "DEEPSEEK",
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com",
    desc: "xAI Node",
    tag: "XAI",
  },
];

export const DEFAULT_AI_PORTAL_IDS = ["gemini", "chatgpt", "claude", "qwen"];
