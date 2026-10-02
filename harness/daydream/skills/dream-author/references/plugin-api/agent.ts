// @daydream/plugin-api/agent — the agent conversation's types (decision
// #87): what `dd.agent` hands a plugin and what the host and the tab say
// to each other about it. Types only.
//
// The conversation is the Agent Client Protocol's (agentclientprotocol.com):
// the host is an ACP client of the user's own agent, and passes what the
// agent sends on as the ACP SDK parses it: a field the SDK's schema does
// not name is stripped, and a session update of a kind it does not know
// is dropped before the host hears it. The ACP shapes below are a subset
// of the protocol's schema, written here so this package stays
// self-contained (the SDK is the host's alone): only the fields a panel
// reads are typed, and the host may pass more — other fields, and updates
// of kinds the SDK knows that are not named here, which a reader passes
// over.

// ---- ACP's own shapes (a subset) --------------------------------------------

/** A piece of a message: ACP's `ContentBlock`. */
export type AgentContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; uri?: string | null }
  | {
      type: "resource_link";
      uri: string;
      name: string;
      mimeType?: string | null;
      title?: string | null;
      description?: string | null;
      /** Its size in bytes. */
      size?: number | null;
    }
  | {
      type: "resource";
      /** A text resource, or a binary one as base64 (`blob`). */
      resource:
        | { uri: string; text: string; mimeType?: string | null }
        | { uri: string; blob: string; mimeType?: string | null };
    }
  | { type: "audio"; data: string; mimeType: string };

/** ACP's `ToolCallStatus`. */
export type AgentToolCallStatus =
  "pending" | "in_progress" | "completed" | "failed";

/** What a tool call produced: ACP's `ToolCallContent`. A `diff` is a
 * file's text before (`oldText`, absent for a new file) and after. */
export type AgentToolCallContent =
  | { type: "content"; content: AgentContentBlock }
  | { type: "diff"; path: string; oldText?: string | null; newText: string }
  | { type: "terminal"; terminalId: string };

/** ACP's `ToolCall`, as `tool_call` reports one. */
export interface AgentToolCall {
  toolCallId: string;
  title: string;
  kind?: string;
  status?: AgentToolCallStatus;
  content?: AgentToolCallContent[];
  locations?: { path: string; line?: number | null }[];
  rawInput?: unknown;
  rawOutput?: unknown;
}

/** ACP's `ToolCallUpdate`: only the fields that changed are present. */
export interface AgentToolCallUpdate {
  toolCallId: string;
  title?: string | null;
  kind?: string | null;
  status?: AgentToolCallStatus | null;
  content?: AgentToolCallContent[] | null;
  locations?: { path: string; line?: number | null }[] | null;
  rawInput?: unknown;
  rawOutput?: unknown;
}

/** One step of the agent's plan: ACP's `PlanEntry`. */
export interface AgentPlanEntry {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}

/** A mode the agent can be in (Claude Code's plan mode, say): ACP's
 * `SessionMode`. */
export interface AgentMode {
  id: string;
  name: string;
  description?: string | null;
}

/** A choice of one of the agent's settings (a model, say): ACP's
 * `SessionConfigSelectOption`. */
export interface AgentConfigChoice {
  value: string;
  name: string;
  description?: string | null;
}

/** One of the agent's settings: ACP's `SessionConfigOption`. A `select`
 * offers choices, flat or in groups; a `boolean` is on or off. */
export type AgentConfigOption = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
} & (
  | {
      type: "select";
      currentValue: string;
      options:
        | AgentConfigChoice[]
        | { group: string; name: string; options: AgentConfigChoice[] }[];
    }
  | { type: "boolean"; currentValue: boolean }
);

/** A slash command the agent offers: ACP's `AvailableCommand`. */
export interface AgentCommand {
  name: string;
  description: string;
}

/** What `session/update` carries: ACP's `SessionUpdate`, the kinds a
 * panel reads. The user's own message comes back as
 * `user_message_chunk`: the host reports each prompt that way too, once
 * the agent took it, so every tab shows it. In the host's transcript a
 * run of one message's text chunks is one chunk. */
export type AgentSessionUpdate =
  | {
      sessionUpdate:
        "user_message_chunk" | "agent_message_chunk" | "agent_thought_chunk";
      content: AgentContentBlock;
      messageId?: string | null;
      /** Daydream's own, on a user chunk the host reported: this block
       * was the prompt's canvas references, the labels its chips had
       * (`dd.agent.prompt`'s `references`). Absent on a chunk an agent
       * replayed. */
      references?: string[];
    }
  | ({ sessionUpdate: "tool_call" } & AgentToolCall)
  | ({ sessionUpdate: "tool_call_update" } & AgentToolCallUpdate)
  | { sessionUpdate: "plan"; entries: AgentPlanEntry[] }
  | {
      sessionUpdate: "available_commands_update";
      availableCommands: AgentCommand[];
    }
  | { sessionUpdate: "current_mode_update"; currentModeId: string }
  | {
      sessionUpdate: "config_option_update";
      configOptions: AgentConfigOption[];
    }
  | { sessionUpdate: "session_info_update"; title?: string | null };

/** An answer the agent offers to a permission request: ACP's
 * `PermissionOption`, shown as its own button, in its own words. */
export interface AgentPermissionOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
}

// ---- Daydream's own ---------------------------------------------------------

/** A known agent, and whether it is on the user's PATH (decision #87).
 * Daydream never installs one: a missing one shows `install`, the line
 * that does. */
export interface AgentListing {
  /** What `dd.agent.start` takes: the only thing a page names. */
  id: string;
  name: string;
  installed: boolean;
  /** The line that installs it. */
  install: string;
  /** The terminal command that signs in, shown when it needs one. */
  signIn: string;
}

/** The agents, the one of the open project's conversation, and the one
 * used last, in any project. */
export interface AgentAgents {
  agents: AgentListing[];
  /** The agent the open project's conversation is with, when it has one:
   * the one a panel resumes, over `last`. */
  project: string | null;
  last: string | null;
  /** Why the agents were looked for on the app's own PATH rather than
   * the user's login shell's — it did not answer in time, or its
   * environment could not be read — said quietly, so an agent shown as
   * not installed is not taken for certain; null when the shell
   * answered. */
  note: string | null;
}

/** A way the agent offers to sign in (ACP's `AuthMethod`), as the panel
 * shows it — Daydream never takes a secret:
 * - `agent`: the agent signs in by itself (it opens the vendor's page in
 *   the browser, say) — `dd.agent.authenticate` asks it to;
 * - `terminal`: a command the user runs in a terminal, `command` the line
 *   to copy;
 * - `env_var`: a variable the user sets in their shell profile, `vars`
 *   their names. */
export type AgentAuthMethod = {
  id: string;
  name: string;
  description?: string | null;
} & (
  | { type: "agent" }
  | { type: "terminal"; command: string }
  | { type: "env_var"; vars: string[] }
);

/** Which block of a prompt carries its canvas references, and the
 * labels of their chips: the host records them beside its transcript,
 * so every tab draws the chips from them. */
export interface AgentPromptReferences {
  /** The index of a text block of the prompt. */
  block: number;
  labels: string[];
}

/** A permission the agent asked for, waiting on an answer: ACP's
 * `session/request_permission`, under the host's id for it. */
export interface AgentPermissionAsk {
  requestId: string;
  toolCall: AgentToolCallUpdate;
  options: AgentPermissionOption[];
}

/** The agent's modes and the one it is in: ACP's `SessionModeState`. */
export interface AgentModes {
  currentModeId: string;
  availableModes: AgentMode[];
}

/** Where the conversation is, each phase carrying only what is true of
 * it (switch on `phase`):
 * - `idle`: none — never started, ended (`dd.agent.newConversation`), or
 *   the project changed; `agentId` the agent chosen for the next, if
 *   any;
 * - `starting`: the agent's process is starting, or its session;
 * - `ready`: a session is open, `busy` while a turn runs — and only now
 *   are the agent's modes and settings there to change;
 * - `sign-in`: the agent says it needs a sign-in, by one of
 *   `authMethods` (none: `AgentListing.signIn` in a terminal), then start
 *   again;
 * - `failed`: it could not start, it stopped, or it did not answer;
 *   `note` says why, and `install` is the line that installs it when that
 *   is why. */
export type AgentStatus =
  | { phase: "idle"; agentId: string | null }
  | { phase: "starting"; agentId: string }
  | {
      phase: "ready";
      agentId: string;
      sessionId: string;
      /** A turn is running: a prompt sent waits until it ends. */
      busy: boolean;
      /** A sentence for the user: that the conversation started fresh
       * because the agent cannot resume one, or how its last turn
       * ended when that was not by finishing. */
      note: string | null;
      /** Whether the agent takes images in a prompt (ACP's
       * `promptCapabilities.image`); one that does not is sent a link to
       * a file the host writes instead. */
      images: boolean;
      /** The agent's modes, when it has any. */
      modes: AgentModes | null;
      /** The agent's settings, when it has any. */
      configOptions: AgentConfigOption[] | null;
    }
  | {
      phase: "sign-in";
      agentId: string;
      /** Why the last sign-in did not take, when one was tried. */
      note: string | null;
      /** The ways the agent offers to sign in: only an `agent` one is
       * something Daydream can ask for (`dd.agent.authenticate`). */
      authMethods: AgentAuthMethod[];
    }
  | {
      phase: "failed";
      agentId: string;
      /** Why, as a sentence for the user. */
      note: string;
      /** The line that installs the agent, when it failed because it is
       * not installed; else null. */
      install: string | null;
    };

/** The whole conversation, as a plugin follows it (`dd.agent.follow`):
 * the status, the updates the host keeps, in order, and the permissions
 * still waiting. The host keeps the last updates of a long conversation
 * and lets the earliest go: `omitted` says how many went (the agent's own
 * session still has them). An image the user sent is kept without its
 * bytes, as a `resource_link` naming its type and size — and its file,
 * when it was written as one (its `uri`; empty for one sent inline). */
export interface AgentThread {
  status: AgentStatus;
  updates: AgentSessionUpdate[];
  /** How many of the earliest updates the host no longer keeps. */
  omitted: number;
  permissions: AgentPermissionAsk[];
}

/** What a plugin following the conversation hears, in order: the whole
 * of it (`thread` — first, and again whenever part of it may have been
 * missed: the host started over, the connection to it came back, a
 * change was lost), then each change after it — the status said, an
 * update the agent (or a prompt) added, a permission asked, one answered
 * (by a tab, or `cancelled`, `optionId` null, by a cancel, the agent
 * taking it back or the end of the conversation), or the transcript
 * emptied for a new conversation. */
export type AgentChange =
  | { type: "thread"; thread: AgentThread }
  | { type: "status"; status: AgentStatus }
  | { type: "update"; update: AgentSessionUpdate }
  | { type: "permission"; ask: AgentPermissionAsk }
  | { type: "resolved"; requestId: string; optionId: string | null }
  | { type: "cleared" };

/** How a start treats the open project's conversation
 * (`AgentConversation.start`) — the host alone decides what it does:
 * - absent: open it — the project's conversation resumed when it is with
 *   that agent (and the agent can, by ACP's `session/load`), one already
 *   open with it kept; another agent's is refused; with none, a new one;
 * - `new`: a new conversation with that agent, the project's ended —
 *   switching agents is the user's choice, and one;
 * - `resume`: only the project's own conversation with that agent,
 *   resumed when it has one and the agent is installed; otherwise
 *   nothing changes. Opening a folder is no word to run an agent in it:
 *   a page asks for a resume, and the host decides, when it runs. */
export type AgentStartIntent = "new" | "resume";

/**
 * What is asked of the open project's conversation (decision #87), the
 * same way at every layer: a plugin's `dd.agent`, the tab's client of the
 * host and the host's own conversation each are this, and add what is
 * theirs. Each rejects with the host's sentence on a refusal.
 */
export interface AgentConversation {
  /** The known agents — installed or not, each with the line that
   * installs it — the open project's conversation's, and the one used
   * last, in any project. Finding them may run the user's login shell. */
  agents(): Promise<AgentAgents>;
  /** Start a conversation with `agentId` in the open project, as
   * `intent` says (AgentStartIntent), answering the status it left. */
  start(
    agentId: string,
    options?: { intent?: AgentStartIntent },
  ): Promise<AgentStatus>;
  /** Send a prompt (ACP content blocks), `references` naming the block
   * that carries its canvas references. Refused while a turn runs.
   * Resolves once the agent took it — its message enters the transcript
   * then, and not before — and rejects, the transcript untouched, when it
   * did not. The turn's end is a status (`busy` false). */
  prompt(
    prompt: AgentContentBlock[],
    options?: { references?: AgentPromptReferences },
  ): Promise<void>;
  /** Cancel the turn that runs (ACP's `session/cancel`): what was said
   * stays, and every permission waiting is answered `cancelled`; a prompt
   * not yet gone never goes. */
  cancel(): Promise<void>;
  /** Answer a permission request with one of the agent's own options.
   * The first answer from any tab wins; a later one is refused. */
  answer(requestId: string, optionId: string): Promise<void>;
  /** End the conversation and forget it: the next one starts fresh. */
  newConversation(): Promise<void>;
  /** Switch the agent's mode (`status.modes`), passed through. */
  setMode(modeId: string): Promise<void>;
  /** Set one of the agent's settings (`status.configOptions`), passed
   * through. */
  setConfig(configId: string, value: string | boolean): Promise<void>;
  /** Sign in by one of the agent's `agent` methods
   * (`status.authMethods`), which the agent carries out itself with no
   * secret from Daydream, then open the conversation. */
  authenticate(methodId: string): Promise<AgentStatus>;
}
