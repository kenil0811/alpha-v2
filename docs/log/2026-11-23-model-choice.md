# 23 Nov 2026: the models Alpha thinks with

Vikas, 23 Nov: "I'd also asked if we can allow multiple Claude versions, multiple ChatGPT
versions, and I also want a decision model that can run locally. So see if there are any open
weight free decision models that can run locally, which can be implemented."

Builds on `2026-11-16-local-models.md`, `2026-11-17-models-page.md` and
`proposals/2026-11-17-llm-optimization-research/2-local-and-on-premise.md` (runners, hardware,
constrained decoding, Perplexity's local split); none of that is repeated here.

## What was true on main, and what this branch builds

| Use | Model on main | Chosen by |
| --- | --- | --- |
| Desk and lanes (every agent turn) | `desk` in `models.yaml` (Opus 5.5) | The owner, per agent, beside its composer, from the `agents` list (Opus, Sonnet, Haiku 5.5); journaled `agent_changed`; a kit may name one |
| One-question asks: reading a document, judging (sorting items into groups), checking a new token, a plugin's own question | Always `desk` (Opus), hard-wired in `engine/ask.ts` | No one |
| `eyes` ("the small one for a yes-or-no") | Declared in `models.yaml`, never read by any code | — |

So several Claude versions were already listed and chosen per agent. The gap: every small
decision ran on Opus. **Built:** `models.yaml` drops the unused `eyes` and names a model per ask
(`asks: reading, judging, checking, plugins`), each one of the listed models (a wall: a config
naming an unlisted model does not load). The ask passes that model to Claude Code; the spend
record already keeps the model each call ran on. Defaults keep today's behaviour except
`checking: claude-haiku-5-5` (it only asks Claude to answer `reached: true`). Moving `judging`
to Haiku or Sonnet waits for a journey, as the rules ask. Not built: the owner changing an ask's
model in Settings › Model (17 Nov: per-use models are Governance rules; window work needs Kenil's yes).

## Local decision models (checked 23 Nov 2026; vendor claims marked)

Alpha's asks, by fitness for a small local model: **judging** (fixed groups or none, a reason
from given facts) is classification, the best fit; **plugins** (an interview's yes/no and
picks) fits case by case; **reading** (values with piece numbers from a document) fails on
values, not format, at 4B (17 Nov study), so it stays on Claude until a backtest says otherwise;
**checking** tests Claude itself and never moves.

| Model | Sizes | RAM at 4-bit | Licence (free for commercial?) | Structured output | Runs on | Fit for judging | Score I×R÷E |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Qwen3.5** (Alibaba, 2 Mar 2026) | 0.8B, 2B, 4B, 9B | ~3 GB (4B), ~6 GB (9B) | Apache-2.0, yes | Strong; cleaner tool calls than Gemma 4 E4B in one test (anecdote) | Ollama, llama.cpp, MLX, LM Studio | Best: 4B on 16 GB Macs, 9B on 24 GB+ | 5×5÷1 = **25** |
| **Gemma 4** (Google, 2 Apr 2026) | E2B, E4B, 26B-A4B, 31B | ~3 GB (E4B) | Apache-2.0 (first Gemma to be), yes | Good format adherence (informal); raw JSON broke in one KG test, so schema-forced only | Ollama, llama.cpp, MLX, LM Studio | Good; also hears audio | 5×4÷1 = **20** |
| **Granite 4.1 / 4.0 Nano** (IBM; 29 Apr 2026 / 28 Oct 2025) | 350M, 1B, 3B, 8B, 30B | <1 GB (1B), ~2 GB (3B) | Apache-2.0, yes; ISO 42001, signed weights | Built for tool calling (vendor) | Ollama, llama.cpp, LM Studio | Good; the enterprise story for buyers; 4.2 announced | 4×4÷1 = **16** |
| **Phi-4-mini** (Microsoft, 2025) | 3.8B | ~2.5 GB | MIT, yes | Fair; function calling (vendor) | Ollama, llama.cpp, LM Studio | Fair; older | 3×4÷1 = **12** |
| **Ministral 3** (Mistral, Dec 2025) | 3B, 8B, 14B | ~2 GB (3B) | Apache-2.0 (secondary source), yes | Fair | Ollama, llama.cpp | Fair | 3×4÷1 = **12** |
| **SmolLM3** (Hugging Face, Jul 2025) | 3B | ~2 GB | Apache-2.0, fully open recipe | Fair | llama.cpp, MLX, Ollama | Fair; open data if training ever matters | 3×3÷1 = **9** |
| **Gemma 3 270M / 1B** (Google, 2025) | 270M, 1B | <1 GB | Gemma terms (use limits, not Apache) | Only after fine-tuning (Google: "for task-specific fine-tuning") | Ollama, llama.cpp, MLX | Later: a fine-tuned router per firm | 3×3÷3 = **3** |
| **Llama 3.2** (Meta, 2024) | 1B, 3B | 1–2 GB | Llama Community Licence: 700M-user cap, use policy, "Built with Llama" | Fair | All runners | Weaker than Qwen3.5 at the same size; licence strings | 2×3÷2 = **3** |
| **LFM2.5 / LFM3** (Liquid AI) | 230M–8B | <1–5 GB | LFM Open v1.0: free only under $10M revenue, the client's own revenue counts | Extract models beat larger ones (vendor) | llama.cpp, Ollama | Not for a product sold to firms of any size | 2×2÷3 = **1.3** |
| Classifiers (ModernBERT-style) and guard/judge models (Granite Guardian, Llama Guard) | 150M–8B | <1–5 GB | Mostly Apache-2.0 | Labels only | Python or ONNX, not the runners | A trained classifier needs labelled data per firm; guard models judge safety, not business groups | 2×2÷5 = **0.8** |

**Recommendation: Qwen3.5-4B on Ollama.** Apache-2.0 with no strings; fits a 16 GB Mac at
4-bit with room to spare (9B for 24 GB+); the strongest small model on structured output in this
pass; Ollama runs on Mac and Windows, forces a JSON schema at the token level (`format`, or
`response_format` on its OpenAI-compatible endpoint), is MIT, and has the largest installed base.
Runners-up: **Gemma 4 E4B** (Apache-2.0, Google, also audio); **Granite 4.1 3B / 4.0 Nano 1B**
(Apache-2.0, signed, ISO 42001: the answer for a careful buyer, and the smallest Macs);
**Phi-4-mini** (MIT, mature). Each must pass a backtest on the firm's own past judgements first.

How others route small decisions locally: Perplexity's Hybrid Compute keeps sensitive steps on a
Mac model (Gemma 4 E4B, Qwen3.6-35B-A3B) behind a privacy check (Sep 2026, press); Apple's
Foundation Models gives a free ~3B on-device model with typed output but no OpenAI-style endpoint;
Ollama, LM Studio, Jan and Osaurus all serve one OpenAI-compatible endpoint that apps such as
Continue, Zed and Raycast point at; Hazy Research's Minions protocol measures local-first with a
cloud fallback. The common shape: one OpenAI-compatible endpoint, schema-forced answers, cloud
when the local answer is unsure.

## ChatGPT and the local model: the proposal (not built)

Both add a provider beside Claude Code, reversing Kenil's 7 Nov call ("Claude Code on the
subscription or a key is the one way to the model", aebf72c8) and design §5. Kenil decides.

| Path | How it plugs in | Terms | Cost | What changes in code | Score I×R÷E |
| --- | --- | --- | --- | --- | --- |
| **Local decision model** | Ollama's server on the Mac (`localhost:11434/v1`); an ask whose use names a local model posts the system prompt, the question and the schema there; nothing leaves the Mac | Apache-2.0 model, MIT runner: fine for a product sold to others | Free; ~3 GB disk and RAM | `models.yaml` lists `ollama:qwen3.5:4b`; `askOnce` picks Claude Code or one `fetch` by the model's prefix; spend records it at $0; the Model page's Download | 5×4÷2 = **10** |
| **ChatGPT through the OpenAI API key** | The firm's key; the Responses API for asks (JSON schema), and for desks either OpenAI's Agents SDK or Codex CLI with `CODEX_API_KEY` | Business terms; built for products serving others | GPT-5 mini $0.25/$2.00 per million tokens in/out, nano $0.05/$0.40 (third-party listings, Sep–Oct 2026; GPT-5.4 mini/nano newer) | A second provider for desks: the gates, tools and session events re-plumbed through another SDK; the biggest piece | 4×3÷5 = **2.4** |
| **ChatGPT plan through Codex CLI** | Codex's "Sign in with ChatGPT", the CLI's default, as Claude Code's subscription is | A person's plan for their own use. OpenAI's Sign in with ChatGPT terms (29 Sep 2026) forbid sharing plan usage or tokens and using one user's subscription for another user's requests: fine for an owner on their own Mac, not for a hosted install serving staff or clients (the same line as the 22 Nov review draws for Claude) | The person's plan ($0 extra) | As above, plus Codex's own sign-in | 3×2÷5 = **1.2** |

**Smallest first step:** the local model for **judging only**, behind a backtest: the owner
downloads Qwen3.5-4B in Settings › Model, Try replays the last 50 judgements, and the use switches
only if it matches Claude on them; Claude remains the fallback when Ollama is not running. No
seam is added now: the one-ask `model` parameter built here is the place it would go.

## Ranked items

| # | Item | I | R | E | Score |
| --- | --- | --- | --- | --- | --- |
| 1 | A model per ask in `models.yaml`, checking on Haiku (built) | 3 | 5 | 1 | **15** |
| 2 | Local decision model for judging, Qwen3.5-4B on Ollama, behind a backtest | 5 | 4 | 2 | **10** |
| 3 | Journey: judging on Haiku 5.5 against Opus, before moving its default | 4 | 4 | 2 | **8** |
| 4 | Owner picks an ask's model on Settings › Model (Governance rule) | 3 | 4 | 2 | **6** |
| 5 | ChatGPT through the firm's OpenAI key | 4 | 3 | 5 | **2.4** |
| 6 | ChatGPT plan through Codex CLI (own Mac only) | 3 | 2 | 5 | **1.2** |

## Sources (checked 23 Nov 2026)

- Qwen3.5 small: [Artificial Analysis, 5 Mar 2026](https://artificialanalysis.ai/articles/qwen3-5-small-models), [Hugging Face Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B), [VentureBeat](https://venturebeat.com/technology/alibabas-small-open-source-qwen3-5-9b-beats-openais-gpt-oss-120b-and-can-run) (vendor-adjacent claims)
- Gemma 4: [Google, 2 Apr 2026](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/), [The Decoder](https://the-decoder.com/googles-gemma-4-is-now-available-with-apache-2-0-licensing-for-the-first-time/); Gemma 3 270M: [Google Developers](https://developers.googleblog.com/en/introducing-gemma-3-270m/)
- Granite: [4.0 Nano, Hugging Face](https://huggingface.co/blog/ibm-granite/granite-4-nano), [4.1, IBM docs](https://www.ibm.com/granite/docs/models/granite4-1), [Artificial Analysis 4.1 8B](https://artificialanalysis.ai/models/granite-4-1-8b)
- SmolLM3: [Hugging Face](https://huggingface.co/HuggingFaceTB/SmolLM3-3B); LFM licence: [Liquid AI docs, 15 Oct 2026](https://docs.liquid.ai/lfm/help/model-license)
- Qwen3.5 vs Gemma 4 structured output: [dev.to (anecdote)](https://dev.to/onewallai/9-reasons-qwen359b-outshines-larger-models-for-local-agents-on-rtx-5070-ti-5c69), [MindStudio](https://www.mindstudio.ai/blog/gemma-4-vs-qwen-3-5-open-weight-comparison)
- Ollama structured outputs: [docs](https://docs.ollama.com/capabilities/structured-outputs)
- OpenAI: [Codex authentication](https://developers.openai.com/codex/auth), [Sign in with ChatGPT terms, 29 Sep 2026](https://openai.com/policies/sign-in-with-chatgpt-terms/), [API pricing](https://developers.openai.com/api/docs/pricing)
- Phi-4-mini (MIT) and Llama 3.2 (Community Licence) from their model cards as known; not re-fetched today
