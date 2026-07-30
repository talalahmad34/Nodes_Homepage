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
    tag: "v1.5_PRO",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com",
    desc: "OpenAI Core",
    tag: "GPT-4o",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    desc: "Anthropic Hub",
    tag: "v3.5_SON",
  },
  {
    id: "qwen",
    name: "Qwen",
    url: "https://chat.qwenlm.ai",
    desc: "Neural Matrix",
    tag: "v2.5_MAX",
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://kimi.moonshot.cn",
    desc: "Moonshot AI",
    tag: "K1.5",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    desc: "DeepSeek Core",
    tag: "V3",
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com",
    desc: "xAI Node",
    tag: "GROK-4",
  },
];

export const DEFAULT_AI_PORTAL_IDS = ["gemini", "chatgpt", "claude", "qwen"];
