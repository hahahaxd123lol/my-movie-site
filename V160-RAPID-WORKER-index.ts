import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CHAT_OWNER_PASSWORD = Deno.env.get("CHAT_OWNER_PASSWORD") ?? "";
const CHAT_TOKEN_SECRET = Deno.env.get("CHAT_TOKEN_SECRET") ?? "";
const ABUSE_SIGNAL_SECRET = Deno.env.get("ABUSE_SIGNAL_SECRET") ?? CHAT_TOKEN_SECRET;

const OWNER_UUID = "f5454804-a2a6-4602-9086-51cf51f11c77";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-f2w-device",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ChatTokenPayload = {
  sub: string;
  owner: boolean;
  alias: string;
  uid?: string;
  iat: number;
  exp: number;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, utf8(value));
  return new Uint8Array(signature);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", utf8(value));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeAlias(value: string) {
  return value.trim().toLowerCase();
}

function validateAlias(alias: string) {
  if (!alias) return "Username is required.";
  if (alias.length < 2 || alias.length > 30) {
    return "Username must be between 2 and 30 characters.";
  }

  // STRICT ASCII ONLY.
  // This rejects spaces, dashes, underscores, punctuation, emoji,
  // accented letters, mathematical/stylized Unicode letters,
  // homoglyphs and all other non-ASCII characters.
  if (!/^[A-Za-z0-9]+$/.test(alias)) {
    return "Username must use only normal English letters A-Z and numbers 0-9.";
  }

  return "";
}


const PUBLIC_CHAT_EXACT_BLOCKS = [
  "103",
  "caversham road",
  "103 caversham road",
  "b440tx",
  "road",
];

const PUBLIC_CHAT_BLOCKED_WORDS = [
  "fuck", "fucking", "fucked", "fucker", "motherfucker",
  "shit", "shitty", "bullshit",
  "bitch", "bastard", "cunt", "dick", "prick", "wanker", "twat",
  "slut", "whore", "piss", "pissed", "asshole",
  "damn", "hell", "bloody", "crap", "arse", "bollocks", "bugger", "cock", "pussy", "sod", "shag",
  "nigger", "nigga", "chink", "gook", "spic", "kike", "paki",
  "coon", "wetback", "raghead", "sandnigger", "faggot", "fag",
];

const PUBLIC_CHAT_LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "!": "i",
};

function normalizePublicChatText(value: string) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .split("")
    .map((ch) => PUBLIC_CHAT_LEET[ch] ?? ch)
    .join("");
}

function escapePublicChatRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function obscuredPublicChatWord(word: string) {
  const body = word
    .split("")
    .map(escapePublicChatRegex)
    .join("[^a-z0-9]*");

  return new RegExp(
    `(?:^|[^a-z0-9])${body}(?:$|[^a-z0-9])`,
    "i",
  );
}

function publicChatLooksLikeAddress(value: string) {
  const normalized = normalizePublicChatText(value);

  // UK-style postcodes, including no-space variants such as B440TX.
  if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(normalized)) {
    return true;
  }

  // Building/house number + street-like suffix.
  if (
    /\b\d{1,5}\s+[a-z0-9][a-z0-9 .,'-]{0,45}\s(?:road|rd|street|st|avenue|ave|lane|ln|drive|dr|close|cl|court|ct|way|place|pl|terrace|crescent|cres|boulevard|blvd|highway|hwy)\b/i
      .test(normalized)
  ) {
    return true;
  }

  // Flat / unit / apartment style address fragments.
  if (
    /\b(?:flat|apartment|apt|unit|house|room)\s*\d+[a-z]?(?:\s|,)+[a-z0-9]/i
      .test(normalized)
  ) {
    return true;
  }

  return false;
}

function moderatePublicChatText(value: string) {
  // Ignore the generated storage URL inside the chat image marker.
  const visible = String(value ?? "")
    .replace(/\[\[image:https:\/\/[^\]\s]+\]\]/gi, " ")
    .trim();

  if (!visible) return "";

  const normalized = normalizePublicChatText(visible);
  const spaced = normalized
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = normalized.replace(/[^a-z0-9]+/g, "");

  if (
    compact.includes("103cavershamroad") ||
    compact.includes("cavershamroad") ||
    compact.includes("b440tx")
  ) {
    return "That message contains blocked personal/address information.";
  }

  for (const phrase of PUBLIC_CHAT_EXACT_BLOCKS) {
    if (phrase === "103") {
      if (/\b103\b/.test(spaced)) {
        return "That message contains blocked personal/address information.";
      }
      continue;
    }

    if (phrase === "road") {
      if (/\broad\b/.test(spaced)) {
        return "That message contains blocked personal/address information.";
      }
      continue;
    }

    const normalizedPhrase = normalizePublicChatText(phrase)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (spaced.includes(normalizedPhrase)) {
      return "That message contains blocked personal/address information.";
    }
  }

  if (publicChatLooksLikeAddress(visible)) {
    return "Physical addresses and address-like information are not allowed in public chat.";
  }

  for (const word of PUBLIC_CHAT_BLOCKED_WORDS) {
    if (obscuredPublicChatWord(word).test(normalized)) {
      return "Swearing, racist language and abusive slurs are not allowed in public chat.";
    }
  }

  return "";
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

async function createChatToken(
  owner: boolean,
  alias: string,
  userId = "",
) {
  if (!CHAT_TOKEN_SECRET) {
    throw new Error("CHAT_TOKEN_SECRET is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);

  const payload: ChatTokenPayload = {
    sub: crypto.randomUUID(),
    owner,
    alias,
    uid: userId || undefined,
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
  };

  const encodedPayload = base64UrlEncode(
    utf8(JSON.stringify(payload)),
  );

  const signature = await hmacSha256(
    encodedPayload,
    CHAT_TOKEN_SECRET,
  );

  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

async function verifyChatToken(
  token: string,
): Promise<ChatTokenPayload | null> {
  try {
    if (!token || !CHAT_TOKEN_SECRET) return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, encodedSignature] = parts;

    const expectedSignature = await hmacSha256(
      encodedPayload,
      CHAT_TOKEN_SECRET,
    );

    const suppliedSignature = base64UrlDecode(encodedSignature);

    if (expectedSignature.length !== suppliedSignature.length) {
      return null;
    }

    let different = 0;

    for (let i = 0; i < expectedSignature.length; i++) {
      different |= expectedSignature[i] ^ suppliedSignature[i];
    }

    if (different !== 0) return null;

    const payloadJson = new TextDecoder().decode(
      base64UrlDecode(encodedPayload),
    );

    const payload = JSON.parse(payloadJson) as ChatTokenPayload;

    if (
      !payload ||
      typeof payload.sub !== "string" ||
      typeof payload.owner !== "boolean" ||
      typeof payload.alias !== "string" ||
      (
        payload.uid !== undefined &&
        typeof payload.uid !== "string"
      ) ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function cleanupOldMessages() {
  const cutoff = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  // Process in bounded batches so cleanup stays fast even after a quiet period.
  // Every deleted row is removed from public.chat_messages, and any chat-media
  // URL embedded in the message is deleted from Storage as well.
  for (let batch = 0; batch < 20; batch += 1) {
    const { data: oldMessages, error: readError } = await supabase
      .from("chat_messages")
      .select("id, message")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(250);

    if (readError) {
      console.error("Old message lookup failed:", readError.message);
      return;
    }

    if (!oldMessages?.length) return;

    for (const row of oldMessages) {
      if (row.message) {
        await cleanupChatMedia(String(row.message));
      }
    }

    const ids = oldMessages
      .map((row) => String(row.id ?? ""))
      .filter(Boolean);

    if (!ids.length) return;

    const { error: deleteError } = await supabase
      .from("chat_messages")
      .delete()
      .in("id", ids);

    if (deleteError) {
      console.error("Old message cleanup failed:", deleteError.message);
      return;
    }

    if (oldMessages.length < 250) return;
  }
}

async function isModerator(alias: string) {
  const normalized = normalizeAlias(alias);
  if (!normalized) return false;

  const profile = await profileForAlias(normalized);

  let query = supabase
    .from("chat_moderators")
    .select("alias, user_id")
    .limit(1);

  if (profile?.user_id) {
    query = query.or(
      `user_id.eq.${profile.user_id},alias.eq.${normalized}`,
    );
  } else {
    query = query.eq("alias", normalized);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Staff lookup failed:", error.message);
    return false;
  }

  return Boolean(data);
}

async function isBanned(alias: string) {
  const normalized = normalizeAlias(alias);
  if (!normalized) return false;

  const profile = await profileForAlias(normalized);

  let query = supabase
    .from("chat_bans")
    .select("alias, user_id, expires_at")
    .limit(1);

  if (profile?.user_id) {
    query = query.or(
      `user_id.eq.${profile.user_id},alias.eq.${normalized}`,
    );
  } else {
    query = query.eq("alias", normalized);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Ban lookup failed:", error.message);
    return false;
  }

  if (!data) return false;

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    if (data.user_id) {
      await supabase.from("chat_bans").delete().eq("user_id", data.user_id);
    } else {
      await supabase.from("chat_bans").delete().eq("alias", normalized);
    }
    return false;
  }

  return true;
}

async function isPublicChatBanned(alias: string) {
  const normalized = normalizeAlias(alias);
  if (!normalized) return false;
  const profile = await profileForAlias(normalized);
  if (!profile?.user_id) return false;

  const { data, error } = await supabase
    .from("public_chat_bans")
    .select("user_id, expires_at")
    .eq("user_id", profile.user_id)
    .maybeSingle();

  // V35 may not have been migrated yet; do not break chat on a missing table.
  if (error) return false;
  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase.from("public_chat_bans").delete().eq("user_id", profile.user_id);
    return false;
  }
  return true;
}

async function setModerator(alias: string, enabled: boolean) {
  const normalized = normalizeAlias(alias);
  if (!normalized) throw new Error("Alias is required.");

  const profile = await profileForAlias(normalized);
  if (!profile?.user_id) throw new Error("User not found.");

  if (profile.user_id === OWNER_UUID) {
    throw new Error("Owner Staff state cannot be changed.");
  }

  if (enabled) {
    await supabase
      .from("chat_moderators")
      .delete()
      .eq("user_id", profile.user_id)
      .neq("alias", normalized);

    const { error } = await supabase
      .from("chat_moderators")
      .upsert(
        {
          alias: normalized,
          user_id: profile.user_id,
          created_at: new Date().toISOString(),
        },
        { onConflict: "alias" },
      );

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("chat_moderators")
      .delete()
      .or(`user_id.eq.${profile.user_id},alias.eq.${normalized}`);

    if (error) throw error;
  }
}

async function setBanned(alias: string, enabled: boolean) {
  const normalized = normalizeAlias(alias);
  if (!normalized) throw new Error("Alias is required.");

  const profile = await profileForAlias(normalized);
  if (!profile?.user_id) throw new Error("User not found.");

  if (profile.user_id === OWNER_UUID) {
    throw new Error("The Owner cannot be banned.");
  }

  if (enabled) {
    await supabase
      .from("chat_bans")
      .delete()
      .eq("user_id", profile.user_id)
      .neq("alias", normalized);

    const { error } = await supabase
      .from("chat_bans")
      .upsert(
        {
          alias: normalized,
          user_id: profile.user_id,
          created_at: new Date().toISOString(),
        },
        { onConflict: "alias" },
      );

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("chat_bans")
      .delete()
      .or(`user_id.eq.${profile.user_id},alias.eq.${normalized}`);

    if (error) throw error;
  }
}

async function profileForAlias(alias: string) {
  const normalized = normalizeAlias(alias);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username")
    .ilike("username", normalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Profile lookup failed:", error.message);
    return null;
  }

  return data ?? null;
}


async function validateCurrentChatAccount(
  payload: ChatTokenPayload,
) {
  if (payload.owner) {
    return {
      user_id: OWNER_UUID,
      username: "josh",
    };
  }

  if (!payload.uid) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username")
    .eq("user_id", payload.uid)
    .maybeSingle();

  if (error || !data) return null;

  if (
    normalizeAlias(String(data.username ?? "")) !==
      normalizeAlias(payload.alias)
  ) {
    return null;
  }

  return data;
}

const DEFAULT_STAFF_PERMISSIONS = new Set([
  "chat_moderate",
  "users_ban",
  "users_mute",
  "users_warn",
  "users_notes",
  "reports_manage",
  "announcements_manage",
  "homepage_manage",
  "streams_manage",
  "collections_manage",
  "support_manage",
  "site_settings_manage",
  "audit_view",
]);

async function staffHasPermission(alias: string, permission: string) {
  const normalized = normalizeAlias(alias);
  if (normalized === "josh") return true;

  if (!await isModerator(normalized)) return false;

  const profile = await profileForAlias(normalized);
  if (!profile?.user_id) {
    return DEFAULT_STAFF_PERMISSIONS.has(permission);
  }

  const { data, error } = await supabase
    .from("staff_permission_overrides")
    .select("allowed")
    .eq("user_id", profile.user_id)
    .eq("permission", permission)
    .maybeSingle();

  if (error) {
    console.error("Staff permission lookup failed:", error.message);
    return DEFAULT_STAFF_PERMISSIONS.has(permission);
  }

  if (data && typeof data.allowed === "boolean") {
    return data.allowed;
  }

  return DEFAULT_STAFF_PERMISSIONS.has(permission);
}

async function targetRole(alias: string) {
  const normalized = normalizeAlias(alias);
  if (!normalized) return "missing";
  if (normalized === "josh") return "owner";

  const profile = await profileForAlias(normalized);
  if (!profile) return "missing";
  if (profile.user_id === OWNER_UUID) return "owner";

  if (await isModerator(normalized)) return "staff";
  return "member";
}

async function staffCanTarget(actorAlias: string, targetAlias: string, owner: boolean) {
  const role = await targetRole(targetAlias);
  if (role === "owner") return false;
  if (role === "staff" && !owner) return false;
  return role !== "missing";
}

async function getSiteSetting<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return fallback;
  return (data.value as T) ?? fallback;
}

async function setSiteSetting(key: string, value: unknown) {
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

  if (error) throw error;
}

async function getChatConfig() {
  const [locked, slow, uploads, pinned] = await Promise.all([
    getSiteSetting<boolean>("chat_locked", false),
    getSiteSetting<number>("chat_slow_mode_seconds", 0),
    getSiteSetting<boolean>("chat_uploads_enabled", true),
    getSiteSetting<string | null>("chat_pinned_message_id", null),
  ]);

  return {
    chat_locked: Boolean(locked),
    chat_slow_mode_seconds: Math.max(0, Number(slow) || 0),
    chat_uploads_enabled: uploads !== false,
    chat_pinned_message_id: pinned || null,
  };
}

async function getPinnedMessage() {
  const config = await getChatConfig();
  if (!config.chat_pinned_message_id) return null;

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, alias, message, created_at")
    .eq("id", config.chat_pinned_message_id)
    .maybeSingle();

  if (error) return null;
  return data ?? null;
}

async function getActiveMute(alias: string) {
  const profile = await profileForAlias(alias);
  if (!profile?.user_id) return null;

  const { data, error } = await supabase
    .from("user_mutes")
    .select("user_id, username, reason, expires_at")
    .eq("user_id", profile.user_id)
    .maybeSingle();

  if (error || !data) return null;

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase.from("user_mutes").delete().eq("user_id", profile.user_id);
    return null;
  }

  return data;
}

async function setMute(alias: string, minutes: number, reason = "") {
  const profile = await profileForAlias(alias);
  if (!profile?.user_id) throw new Error("User not found.");

  const expiresAt = new Date(
    Date.now() + Math.max(1, minutes) * 60 * 1000,
  ).toISOString();

  const { error } = await supabase
    .from("user_mutes")
    .upsert(
      {
        user_id: profile.user_id,
        username: normalizeAlias(alias),
        reason: reason.slice(0, 500) || null,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

async function clearMute(alias: string) {
  const profile = await profileForAlias(alias);
  if (!profile?.user_id) throw new Error("User not found.");

  const { error } = await supabase
    .from("user_mutes")
    .delete()
    .eq("user_id", profile.user_id);

  if (error) throw error;
}

async function warnAlias(alias: string, reason: string) {
  const profile = await profileForAlias(alias);
  if (!profile?.user_id) throw new Error("User not found.");

  const { error } = await supabase
    .from("user_warnings")
    .insert({
      user_id: profile.user_id,
      username: normalizeAlias(alias),
      reason: reason.slice(0, 1000),
      active: true,
    });

  if (error) throw error;
}

async function auditAlias(
  actorAlias: string,
  action: string,
  targetType: string | null = null,
  targetId: string | null = null,
  details: Record<string, unknown> = {},
) {
  const profile = await profileForAlias(actorAlias);

  const { error } = await supabase
    .from("staff_audit_log")
    .insert({
      actor_user_id: profile?.user_id ?? null,
      actor_username: normalizeAlias(actorAlias),
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });

  if (error) {
    console.error("Audit log failed:", error.message);
  }
}

async function emitAccountEventForAlias(
  targetAlias: string,
  eventType: string,
  title: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  const profile = await profileForAlias(targetAlias);
  if (!profile?.user_id) return;

  const { error } = await supabase
    .from("account_events")
    .insert({
      user_id: profile.user_id,
      event_type: eventType,
      title,
      message,
      details,
      created_by: null,
    });

  if (error) {
    console.error("Account event insert failed:", error.message);
  }
}


function parseDuration(value: string) {
  const raw = value.trim().toLowerCase();
  const match = raw.match(/^(\d+)(m|h|d)$/);
  if (!match) return 0;

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "m") return amount;
  if (unit === "h") return amount * 60;
  if (unit === "d") return amount * 1440;
  return 0;
}

async function enforceSlowMode(alias: string, seconds: number) {
  if (seconds <= 0) return 0;

  const { data, error } = await supabase
    .from("chat_messages")
    .select("created_at")
    .ilike("alias", normalizeAlias(alias))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.created_at) return 0;

  const elapsed = (Date.now() - new Date(data.created_at).getTime()) / 1000;
  return Math.max(0, Math.ceil(seconds - elapsed));
}

async function cleanupChatMedia(message: string) {
  const regex =
    /\[\[image:(https:\/\/viqufxlcxwgboyxbdhjb\.supabase\.co\/storage\/v1\/object\/public\/chat-media\/([^\]\s]+))\]\]/g;

  const paths: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(message))) {
    try {
      paths.push(decodeURIComponent(match[2]));
    } catch {
      paths.push(match[2]);
    }
  }

  if (paths.length) {
    const { error } = await supabase.storage.from("chat-media").remove(paths);
    if (error) console.error("Chat media cleanup failed:", error.message);
  }
}


async function getActiveAnnouncement() {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("site_announcements")
    .select("id, message, created_at, starts_at, expires_at")
    .eq("active", true)
    .lte("starts_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function setAnnouncement(message: string) {
  const text = message.trim();

  if (!text) {
    throw new Error("Announcement message cannot be empty.");
  }

  if (text.length > 500) {
    throw new Error("Announcement must be 500 characters or less.");
  }

  const { error: deactivateError } = await supabase
    .from("site_announcements")
    .update({ active: false })
    .eq("active", true);

  if (deactivateError) throw deactivateError;

  const { data, error } = await supabase
    .from("site_announcements")
    .insert({
      message: text,
      active: true,
      created_by_alias: "staff",
    })
    .select("id, message, created_at")
    .single();

  if (error) throw error;
  return data;
}

async function clearAnnouncement() {
  const { error } = await supabase
    .from("site_announcements")
    .update({ active: false })
    .eq("active", true);

  if (error) throw error;
}

async function getMessages() {
  const cutoff = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id, alias, message, created_at, owner_id")
    .gt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) throw error;

  const { data: moderators, error: moderatorError } = await supabase
    .from("chat_moderators")
    .select("alias");

  if (moderatorError) throw moderatorError;

  const moderatorSet = new Set(
    (moderators ?? []).map((row) =>
      normalizeAlias(String(row.alias ?? ""))
    ),
  );

  return (messages ?? []).map((message) => {
    const alias = String(message.alias ?? "");
    const normalizedAlias = normalizeAlias(alias);
    const owner = normalizedAlias === "josh" || Boolean(message.owner_id);

    return {
      id: message.id,
      alias,
      message: message.message,
      created_at: message.created_at,
      owner,
      moderator: !owner && moderatorSet.has(normalizedAlias),
    };
  });
}

async function purgeAliasMessages(targetAlias: string) {
  const normalized = normalizeAlias(targetAlias);

  if (!normalized) {
    throw new Error("Alias is required.");
  }

  const cutoff = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, alias")
    .gt("created_at", cutoff);

  if (error) throw error;

  const ids = (data ?? [])
    .filter((row) => normalizeAlias(String(row.alias ?? "")) === normalized)
    .map((row) => String(row.id));

  if (!ids.length) return 0;

  const { error: deleteError } = await supabase
    .from("chat_messages")
    .delete()
    .in("id", ids);

  if (deleteError) throw deleteError;

  return ids.length;
}

async function clearRecentChat() {
  const cutoff = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("chat_messages")
    .delete()
    .gt("created_at", cutoff)
    .select("id");

  if (error) throw error;
  return (data ?? []).length;
}

async function getAliasStatus(targetAlias: string) {
  const normalized = normalizeAlias(targetAlias);

  if (!normalized) {
    throw new Error("Alias is required.");
  }

  if (normalized === "josh") {
    return "josh: OWNER";
  }

  const moderator = await isModerator(normalized);
  const banned = await isBanned(normalized);
  const mute = await getActiveMute(normalized);

  const roles: string[] = [];
  if (moderator) roles.push("STAFF");
  if (banned) roles.push("BANNED");
  if (mute) roles.push("MUTED");
  if (!roles.length) roles.push("MEMBER");

  return `${targetAlias}: ${roles.join(" + ")}`;
}

async function handleCommand(
  payload: ChatTokenPayload,
  message: string,
) {
  const trimmed = message.trim();
  const firstSpace = trimmed.indexOf(" ");
  const command = (
    firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
  ).toLowerCase();

  const argument =
    firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();

  const moderator = payload.owner
    ? false
    : await isModerator(payload.alias);

  const canModerate = payload.owner || moderator;

  if (command === "/help") {
    if (payload.owner) {
      return {
        success: true,
        command: true,
        visible_to_sender_only: true,
        message:
          "OWNER COMMANDS\n/help\n/staff ALIAS\n/unstaff ALIAS\n/ban ALIAS\n/unban ALIAS\n/mute ALIAS 10m [REASON]\n/unmute ALIAS\n/warn ALIAS REASON\n/purge ALIAS\n/clear\n/status ALIAS\n/announce MESSAGE\n/unannounce\n/lockchat\n/unlockchat\n/slowmode SECONDS\n/pin MESSAGE_ID\n/unpin",
      };
    }

    if (moderator) {
      return {
        success: true,
        command: true,
        visible_to_sender_only: true,
        message:
          "STAFF COMMANDS\n/help\n/ban ALIAS\n/unban ALIAS\n/mute ALIAS 10m [REASON]\n/unmute ALIAS\n/warn ALIAS REASON\n/purge ALIAS\n/clear\n/status ALIAS\n/announce MESSAGE\n/unannounce\n/lockchat\n/unlockchat\n/slowmode SECONDS\n/pin MESSAGE_ID\n/unpin",
      };
    }

    return {
      success: false,
      command: true,
      visible_to_sender_only: true,
      error: "You do not have permission to use staff commands.",
    };
  }

  if (command === "/announce" || command === "/unannounce") {
    const canAnnounce = payload.owner ||
      await staffHasPermission(payload.alias, "announcements_manage");

    if (!canAnnounce) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You do not have permission to manage site announcements.",
      };
    }

    if (command === "/announce") {
      if (!argument) {
        return {
          success: false,
          command: true,
          visible_to_sender_only: true,
          error: "Usage: /announce MESSAGE",
        };
      }

      const announcement = await setAnnouncement(argument);
      await auditAlias(
        payload.owner ? "josh" : payload.alias,
        "announcement_publish",
        "announcement",
        String(announcement.id),
      );

      return {
        success: true,
        command: true,
        visible_to_sender_only: true,
        message: "Site announcement published.",
        announcement,
      };
    }

    await clearAnnouncement();
    await auditAlias(
      payload.owner ? "josh" : payload.alias,
      "announcement_clear",
      "announcement",
    );

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message: "Site announcement removed.",
      announcement: null,
    };
  }

  if (command === "/staff" || command === "/unstaff" || command === "/mod" || command === "/unmod") {
    if (!payload.owner) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Only the owner can change staff status.",
      };
    }

    if (!argument) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: `Usage: ${command} ALIAS`,
      };
    }

    if (normalizeAlias(argument) === "josh") {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Josh is the owner and cannot be changed to staff.",
      };
    }

    const makingStaff = command === "/staff" || command === "/mod";
    await setModerator(argument, makingStaff);
    await emitAccountEventForAlias(
      argument,
      makingStaff ? "staff_granted" : "staff_revoked",
      makingStaff ? "You are now Flix2Watch Staff" : "Your Staff access was removed",
      makingStaff
        ? "The Owner granted this account Staff access. The Staff Control Center is now available."
        : "The Owner removed Staff permissions from this account.",
    );
    await auditAlias(
      "josh",
      makingStaff ? "staff_grant" : "staff_revoke",
      "user",
      normalizeAlias(argument),
    );

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message:
        makingStaff
          ? `${argument} is now staff.`
          : `${argument} is no longer staff.`,
    };
  }

  if (command === "/ban" || command === "/unban") {
    const canBan = payload.owner ||
      await staffHasPermission(payload.alias, "users_ban");

    if (!canBan) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You do not have permission to change ban status.",
      };
    }

    if (!argument) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: `Usage: ${command} ALIAS`,
      };
    }

    if (normalizeAlias(argument) === "josh") {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "The website owner cannot be banned.",
      };
    }

    if (!await staffCanTarget(payload.alias, argument, payload.owner)) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You cannot moderate that account.",
      };
    }

    await setBanned(argument, command === "/ban");
    await emitAccountEventForAlias(
      argument,
      command === "/ban" ? "ban" : "unban",
      command === "/ban"
        ? "Your account has been banned"
        : "Your account has been unbanned",
      command === "/ban"
        ? "Staff have suspended this account from using Flix2Watch."
        : "Staff have restored access to Flix2Watch for this account.",
      command === "/ban"
        ? { reason: "Banned by Staff command", expires_at: null }
        : {},
    );
    await auditAlias(
      payload.owner ? "josh" : payload.alias,
      command === "/ban" ? "user_ban" : "user_unban",
      "user",
      normalizeAlias(argument),
    );

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message:
        command === "/ban"
          ? `${argument} is now banned from sending messages.`
          : `${argument} has been unbanned.`,
    };
  }


  if (command === "/mute" || command === "/unmute") {
    const canMute = payload.owner ||
      await staffHasPermission(payload.alias, "users_mute");

    if (!canMute) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You do not have permission to mute users.",
      };
    }

    const parts = argument.split(/\s+/).filter(Boolean);
    const target = parts[0] ?? "";

    if (!target) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: command === "/mute"
          ? "Usage: /mute ALIAS 10m [REASON]"
          : "Usage: /unmute ALIAS",
      };
    }

    if (!await staffCanTarget(payload.alias, target, payload.owner)) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You cannot moderate that account.",
      };
    }

    if (command === "/unmute") {
      await clearMute(target);
      await emitAccountEventForAlias(
        target,
        "unmute",
        "Your mute has been removed",
        "Staff have restored your ability to send chat messages.",
      );
      await auditAlias(
        payload.owner ? "josh" : payload.alias,
        "user_unmute",
        "user",
        normalizeAlias(target),
      );

      return {
        success: true,
        command: true,
        visible_to_sender_only: true,
        message: `${target} has been unmuted.`,
      };
    }

    const minutes = parseDuration(parts[1] ?? "");

    if (!minutes) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Use a duration such as 10m, 1h, 1d or 7d.",
      };
    }

    const reason = parts.slice(2).join(" ");
    await setMute(target, minutes, reason);
    await emitAccountEventForAlias(
      target,
      "mute",
      "You have been muted",
      "Staff have temporarily disabled chat sending for your account.",
      {
        reason: reason || null,
        duration_minutes: minutes,
        expires_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
      },
    );
    await auditAlias(
      payload.owner ? "josh" : payload.alias,
      "user_mute",
      "user",
      normalizeAlias(target),
      { minutes, reason },
    );

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message: `${target} muted for ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  if (command === "/warn") {
    const canWarn = payload.owner ||
      await staffHasPermission(payload.alias, "users_warn");

    if (!canWarn) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You do not have permission to warn users.",
      };
    }

    const parts = argument.split(/\s+/).filter(Boolean);
    const target = parts.shift() ?? "";
    const reason = parts.join(" ");

    if (!target || !reason) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Usage: /warn ALIAS REASON",
      };
    }

    if (!await staffCanTarget(payload.alias, target, payload.owner)) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You cannot moderate that account.",
      };
    }

    await warnAlias(target, reason);
    await emitAccountEventForAlias(
      target,
      "warning",
      "You received a Staff warning",
      reason,
      { reason },
    );
    await auditAlias(
      payload.owner ? "josh" : payload.alias,
      "user_warning",
      "user",
      normalizeAlias(target),
      { reason },
    );

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message: `Warning added to ${target}.`,
    };
  }

  if (
    command === "/lockchat" ||
    command === "/unlockchat" ||
    command === "/slowmode" ||
    command === "/pin" ||
    command === "/unpin"
  ) {
    const canControlChat = payload.owner ||
      await staffHasPermission(payload.alias, "chat_moderate");

    if (!canControlChat) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You do not have permission to control chat.",
      };
    }

    if (command === "/lockchat" || command === "/unlockchat") {
      const locked = command === "/lockchat";
      await setSiteSetting("chat_locked", locked);
      await auditAlias(
        payload.owner ? "josh" : payload.alias,
        locked ? "chat_lock" : "chat_unlock",
        "chat",
      );

      return {
        success: true,
        command: true,
        visible_to_sender_only: true,
        message: locked ? "Chat locked for members." : "Chat unlocked.",
      };
    }

    if (command === "/slowmode") {
      return {
        success: true,
        command: true,
        visible_to_sender_only: true,
        message: "Public chat slow mode is permanently locked to 5 seconds.",
      };
    }

    if (command === "/unpin") {
      await setSiteSetting("chat_pinned_message_id", null);
      await auditAlias(
        payload.owner ? "josh" : payload.alias,
        "chat_unpin",
        "chat",
      );

      return {
        success: true,
        command: true,
        visible_to_sender_only: true,
        message: "Pinned message removed.",
      };
    }

    if (!argument) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Usage: /pin MESSAGE_ID",
      };
    }

    const { data: pinMessage, error: pinError } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("id", argument)
      .maybeSingle();

    if (pinError || !pinMessage) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Chat message not found.",
      };
    }

    await setSiteSetting("chat_pinned_message_id", argument);
    await auditAlias(
      payload.owner ? "josh" : payload.alias,
      "chat_pin",
      "chat",
      argument,
    );

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message: "Message pinned.",
    };
  }

  if (command === "/purge") {
    const canPurge = payload.owner ||
      await staffHasPermission(payload.alias, "chat_moderate");

    if (!canPurge) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You do not have permission to purge messages.",
      };
    }

    if (!argument) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Usage: /purge ALIAS",
      };
    }

    if (!payload.owner && normalizeAlias(argument) === "josh") {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Staff cannot purge owner messages.",
      };
    }

    if (!await staffCanTarget(payload.alias, argument, payload.owner)) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You cannot purge that account's messages.",
      };
    }

    const count = await purgeAliasMessages(argument);
    await auditAlias(
      payload.owner ? "josh" : payload.alias,
      "chat_purge_user",
      "user",
      normalizeAlias(argument),
      { count },
    );

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message: `Purged ${count} message${count === 1 ? "" : "s"} from ${argument}.`,
    };
  }

  if (command === "/clear") {
    const canClear = payload.owner ||
      await staffHasPermission(payload.alias, "chat_moderate");

    if (!canClear) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You do not have permission to clear chat.",
      };
    }

    const count = await clearRecentChat();
    await auditAlias(
      payload.owner ? "josh" : payload.alias,
      "chat_clear",
      "chat",
      null,
      { count },
    );

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message: `Cleared ${count} message${count === 1 ? "" : "s"} from the public chat.`,
    };
  }

  if (command === "/status") {
    const canStatus = payload.owner ||
      await staffHasPermission(payload.alias, "chat_moderate");

    if (!canStatus) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "You do not have permission to inspect moderation status.",
      };
    }

    if (!argument) {
      return {
        success: false,
        command: true,
        visible_to_sender_only: true,
        error: "Usage: /status ALIAS",
      };
    }

    return {
      success: true,
      command: true,
      visible_to_sender_only: true,
      message: await getAliasStatus(argument),
    };
  }

  return {
    success: false,
    command: true,
    visible_to_sender_only: true,
    error: "Unknown command. Use /help.",
  };
}


/* ---------- BAN-EVASION / DEVICE SIGNAL GUARD ---------- */
function getRequestIp(request: Request) {
  const cf = String(request.headers.get("cf-connecting-ip") ?? "").trim();
  if (cf) return cf;
  const forwarded = String(request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "";
}

function cleanSignal(value: unknown, max = 2048) {
  return String(value ?? "").trim().slice(0, max);
}

async function hashAbuseSignal(kind: string, value: string) {
  if (!value) return "";
  return sha256Hex(`${ABUSE_SIGNAL_SECRET}|${kind}|${value}`);
}

async function buildAbuseSignals(request: Request, body: Record<string, unknown>) {
  const deviceId = cleanSignal(body.device_id, 200);
  const fingerprint = cleanSignal(body.fingerprint, 3000);
  const ua = cleanSignal(request.headers.get("user-agent"), 1200);
  const ip = cleanSignal(getRequestIp(request), 200);

  const [device_hash, fingerprint_hash, ua_hash, ip_hash, ip_ua_hash] =
    await Promise.all([
      hashAbuseSignal("device", deviceId),
      hashAbuseSignal("fingerprint", fingerprint),
      hashAbuseSignal("ua", ua),
      hashAbuseSignal("ip", ip),
      ip && ua ? hashAbuseSignal("ip_ua", `${ip}|${ua}`) : Promise.resolve(""),
    ]);

  const signal_key = await hashAbuseSignal(
    "signal_key",
    [device_hash, fingerprint_hash, ua_hash, ip_hash].join("|"),
  );

  return {
    signal_key,
    device_hash,
    fingerprint_hash,
    ua_hash,
    ip_hash,
    ip_ua_hash,
  };
}

async function checkBanEvasion(signals: {
  device_hash: string;
  fingerprint_hash: string;
  ip_hash: string;
  ip_ua_hash: string;
}) {
  const hashes = [
    signals.device_hash,
    signals.fingerprint_hash,
    signals.ip_hash,
    signals.ip_ua_hash,
  ].filter(Boolean);

  if (!hashes.length) {
    return { blocked: false, networkMatch: false, match: null as any };
  }

  const { data, error } = await supabase
    .from("ban_evasion_blocks")
    .select("source_user_id,signal_type,signal_hash,reason,expires_at,created_at")
    .in("signal_hash", hashes)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    console.error("ban_evasion_blocks lookup failed:", error.message);
    return { blocked: false, networkMatch: false, match: null as any };
  }

  const rows = Array.isArray(data) ? data : [];
  const hard =
    rows.find((row: any) =>
      row.signal_type === "device" &&
      row.signal_hash === signals.device_hash
    ) ??
    rows.find((row: any) =>
      row.signal_type === "fingerprint" &&
      row.signal_hash === signals.fingerprint_hash
    );

  const network =
    rows.find((row: any) =>
      row.signal_type === "ip_ua" &&
      row.signal_hash === signals.ip_ua_hash
    ) ??
    rows.find((row: any) =>
      row.signal_type === "ip" &&
      row.signal_hash === signals.ip_hash
    );

  // v39 strict policy: exact banned IP+UA, or the exact banned IP itself,
  // is a hard block. This is intentionally stronger and can affect shared/VPN IPs.
  return {
    blocked: Boolean(hard || network),
    networkMatch: Boolean(network),
    match: hard ?? network ?? null,
  };
}

async function recordAccountSignals(
  userId: string,
  signals: {
    signal_key: string;
    device_hash: string;
    fingerprint_hash: string;
    ua_hash: string;
    ip_hash: string;
    ip_ua_hash: string;
  },
) {
  if (!userId || !signals.signal_key) return;

  const row = {
    user_id: userId,
    signal_key: signals.signal_key,
    device_hash: signals.device_hash || null,
    fingerprint_hash: signals.fingerprint_hash || null,
    ua_hash: signals.ua_hash || null,
    ip_hash: signals.ip_hash || null,
    ip_ua_hash: signals.ip_ua_hash || null,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("account_device_signals")
    .upsert(row, { onConflict: "user_id,signal_key" });

  if (error) {
    console.error("account_device_signals upsert failed:", error.message);
  }
}

async function logBanEvasionHit(
  attemptedUserId: string | null,
  match: any,
  signals: {
    device_hash: string;
    fingerprint_hash: string;
    ip_ua_hash: string;
  },
  outcome = "blocked",
) {
  const { error } = await supabase.from("ban_evasion_hits").insert({
    attempted_user_id: attemptedUserId || null,
    source_user_id: match?.source_user_id || null,
    matched_signal_type: match?.signal_type || null,
    matched_signal_hash: match?.signal_hash || null,
    device_hash: signals.device_hash || null,
    fingerprint_hash: signals.fingerprint_hash || null,
    ip_ua_hash: signals.ip_ua_hash || null,
    outcome,
  });

  if (error) {
    console.error("ban_evasion_hits insert failed:", error.message);
  }
}

async function suspendEvasionAccount(
  userId: string,
  reason = "Ban evasion detected",
) {
  if (!userId || userId === OWNER_UUID) return;

  const now = new Date().toISOString();

  await supabase.from("account_login_bans").upsert({
    user_id: userId,
    reason,
    expires_at: null,
    updated_at: now,
  }, { onConflict: "user_id" }).catch(() => null);

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.username) {
    await supabase.from("chat_bans").upsert({
      alias: String(profile.username).toLowerCase(),
      reason,
      expires_at: null,
    }, { onConflict: "alias" }).catch(() => null);
  }
}

async function getBearerUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user;
}

async function activeAccountLoginBan(userId: string) {
  // v160: account_enforcement_v146 is the ONLY login-ban authority.
  // A historical account_login_bans row left behind by an old Site Suspension
  // must never block a user after Staff has removed the restriction.
  const { data, error } = await supabase
    .from("account_enforcement_v146")
    .select("account_banned,reason,expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || data.account_banned !== true) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }
  return { reason: data.reason, expires_at: data.expires_at };
}


async function enforcePublicChatSlowMode(userId: string | null): Promise<void> {
  if (!userId) throw new Error("Authentication required");

  const { data, error } = await supabase.rpc("enforce_public_chat_slowmode_v37", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || "Slow mode check failed");
  }

  const result = Array.isArray(data) ? data[0] : data;
  const allowed = result?.allowed !== false;
  const retryAfter = Number(result?.retry_after_seconds || 0);

  if (!allowed) {
    const err = new Error(`Slow mode: wait ${Math.max(1, retryAfter)} seconds before sending another public message.`);
    (err as any).status = 429;
    throw err;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      {
        success: false,
        error: "Supabase service configuration is missing.",
      },
      500,
    );
  }

  if (!CHAT_TOKEN_SECRET) {
    return json(
      {
        success: false,
        error: "CHAT_TOKEN_SECRET is not configured.",
      },
      500,
    );
  }

  try {
    // F2W v34 performance:
    // The database cron job owns the guaranteed 24-hour purge.
    // Do NOT block every chat request on a potentially large cleanup scan.
    if (request.method === "GET") {
      const [messages, announcement, config, pinnedMessage] = await Promise.all([
        getMessages(),
        getActiveAnnouncement(),
        getChatConfig(),
        getPinnedMessage(),
      ]);

      return json({
        success: true,
        messages,
        announcement,
        config,
        pinned_message: pinnedMessage,
      });
    }

    if (request.method !== "POST") {
      return json(
        { success: false, error: "Method not allowed." },
        405,
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return json(
        { success: false, error: "Invalid JSON body." },
        400,
      );
    }

    const action = String(body.action ?? "").trim();

    if (action === "list") {
      const [messages, announcement, config, pinnedMessage] = await Promise.all([
        getMessages(), getActiveAnnouncement(), getChatConfig(), getPinnedMessage(),
      ]);
      return new Response(JSON.stringify({ success: true, messages, announcement, config, pinned_message: pinnedMessage }), {status:200, headers:{...CORS_HEADERS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=3, stale-while-revalidate=15"}});
    }


    if (action === "abuse_preflight") {
      // v159: keep signup available. Account moderation is enforced against the
      // account itself, not every account sharing an IP/browser. This endpoint is
      // intentionally lightweight so Site Suspension cannot break registration.
      return json({ success: true, allowed: true, network_match: false });
    }

    if (action === "abuse_register") {
      const user = await getBearerUser(request);
      if (!user?.id) {
        return json({
          success: false,
          code: "AUTH_REQUIRED",
          error: "Authentication required.",
        }, 401);
      }

      const signals = await buildAbuseSignals(request, body);
      const decision = await checkBanEvasion(signals);

      await recordAccountSignals(String(user.id), signals);

      if (decision.blocked && String(user.id) !== String(decision.match?.source_user_id || "")) {
        await suspendEvasionAccount(String(user.id), "Ban evasion detected");
        await logBanEvasionHit(String(user.id), decision.match, signals, "account_suspended");
        return json({
          success: false,
          code: "BAN_EVASION_BLOCKED",
          error: "This account has been suspended because it matches a previously banned device.",
        }, 403);
      }

      if (decision.networkMatch) {
        await logBanEvasionHit(String(user.id), decision.match, signals, "network_match_only");
      }

      return json({ success: true, registered: true });
    }

    if (action === "login_identifier") {
      const identifier = String(body.identifier ?? "").trim();
      const password = String(body.password ?? "");

      if (!identifier || !password) {
        return json(
          {
            success: false,
            error: "Enter your username/email and password.",
          },
          400,
        );
      }

      // v159: login moderation is account-scoped, never device/IP-scoped.
      // A Site Suspension on one account must not poison login for every other
      // account using the same browser/network. Device signals are still recorded
      // after a successful login for staff audit, but they do not gate login.
      const abuseSignals = await buildAbuseSignals(request, body);
      const abuseDecision = { blocked: false, networkMatch: false, match: null } as any;

      let email = identifier;

      if (!identifier.includes("@")) {
        if (!/^[A-Za-z0-9]{2,30}$/.test(identifier)) {
          return json(
            {
              success: false,
              error: "Invalid username/email or password.",
            },
            401,
          );
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_id")
          .ilike("username", identifier)
          .maybeSingle();

        if (profileError || !profile?.user_id) {
          return json(
            {
              success: false,
              error: "Invalid username/email or password.",
            },
            401,
          );
        }

        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(String(profile.user_id));

        if (userError || !userData?.user?.email) {
          return json(
            {
              success: false,
              error: "Invalid username/email or password.",
            },
            401,
          );
        }

        email = userData.user.email;
      }

      const tokenResponse = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const tokenBody = await tokenResponse.json().catch(() => ({}));

      if (
        !tokenResponse.ok ||
        !tokenBody?.access_token ||
        !tokenBody?.refresh_token
      ) {
        return json(
          {
            success: false,
            error: "Invalid username/email or password.",
          },
          401,
        );
      }

      const tokenUserId = String(tokenBody?.user?.id || "");
      if (tokenUserId) {
        const loginBan = await activeAccountLoginBan(tokenUserId);
        if (loginBan) {
          return json({
            success: false,
            code: "ACCOUNT_BANNED",
            error: loginBan.reason || "This account is suspended.",
          }, 403);
        }

        await recordAccountSignals(tokenUserId, abuseSignals);

        if (abuseDecision.networkMatch) {
          await logBanEvasionHit(tokenUserId, abuseDecision.match, abuseSignals, "network_match_only");
        }
      }

      return json({
        success: true,
        access_token: tokenBody.access_token,
        refresh_token: tokenBody.refresh_token,
        expires_in: tokenBody.expires_in,
        token_type: tokenBody.token_type,
        user: tokenBody.user,
      });
    }

    if (action === "create_identity") {
      const newToken = await createChatToken(false, "");

      return json({
        success: true,
        token: newToken,
        owner: false,
        moderator: false,
        banned: false,
        alias: "",
      });
    }

    if (action === "set_alias") {
      const existingToken = getBearerToken(request);
      const payload = await verifyChatToken(existingToken);

      if (!payload) {
        return json(
          {
            success: false,
            error: "Invalid or expired chat token.",
          },
          401,
        );
      }

      if (payload.owner) {
        return json({
          success: true,
          token: existingToken,
          alias: "josh",
          owner: true,
          moderator: false,
          banned: false,
        });
      }

      if (payload.alias.trim()) {
        return json(
          {
            success: false,
            error: "This chat identity already has a permanent alias.",
          },
          409,
        );
      }

      const alias = String(body.alias ?? "");
      const aliasError = validateAlias(alias);

      if (aliasError) {
        return json(
          { success: false, error: aliasError },
          400,
        );
      }

      if (normalizeAlias(alias) === "josh") {
        return json(
          {
            success: false,
            error: "The Josh alias is reserved for the website owner.",
          },
          403,
        );
      }

      const supabaseAccessToken = String(
        body.supabase_access_token ?? "",
      ).trim();

      if (!supabaseAccessToken) {
        return json(
          {
            success: false,
            error: "Supabase account authentication is required.",
          },
          401,
        );
      }

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser(supabaseAccessToken);

      if (authError || !authData?.user) {
        return json(
          {
            success: false,
            error: "Could not verify your Supabase account.",
          },
          401,
        );
      }

      if (authData.user.id === OWNER_UUID) {
        return json(
          {
            success: false,
            error: "Owner chat must use Owner activation.",
          },
          403,
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, username")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        normalizeAlias(String(profile.username ?? "")) !==
          normalizeAlias(alias)
      ) {
        return json(
          {
            success: false,
            error: "Chat username must match your current Flix2Watch profile.",
          },
          403,
        );
      }

      const newToken = await createChatToken(
        false,
        alias,
        authData.user.id,
      );
      const moderator = await isModerator(alias);
      const banned = await isBanned(alias);

      return json({
        success: true,
        token: newToken,
        alias,
        owner: false,
        moderator,
        banned,
      });
    }

    if (action === "owner_login") {
      if (!CHAT_OWNER_PASSWORD) {
        return json(
          {
            success: false,
            error: "CHAT_OWNER_PASSWORD is not configured.",
          },
          500,
        );
      }

      const password = String(body.password ?? "");

      if (password !== CHAT_OWNER_PASSWORD) {
        return json(
          {
            success: false,
            error: "Incorrect owner chat password.",
          },
          401,
        );
      }

      const ownerToken = await createChatToken(true, "josh", OWNER_UUID);

      return json({
        success: true,
        token: ownerToken,
        alias: "josh",
        owner: true,
        moderator: false,
        banned: false,
      });
    }

    if (action === "verify") {
      const token = getBearerToken(request);
      const payload = await verifyChatToken(token);

      if (payload && !payload.owner) {
        const storedAliasError = validateAlias(payload.alias);
        if (storedAliasError) {
          return json(
            { success: false, error: "This account has an invalid username format." },
            400,
          );
        }
      }

      if (!payload) {
        return json(
          {
            success: false,
            authenticated: false,
            error: "Invalid or expired chat token.",
          },
          401,
        );
      }

      if (!payload.owner) {
        const currentAccount = await validateCurrentChatAccount(payload);

        if (!currentAccount) {
          return json(
            {
              success: false,
              authenticated: false,
              error: "Chat identity needs to be refreshed for your current username.",
            },
            401,
          );
        }
      }

      const moderator = payload.owner
        ? false
        : await isModerator(payload.alias);

      const banned = payload.owner
        ? false
        : await isBanned(payload.alias);

      return json({
        success: true,
        authenticated: true,
        alias: payload.owner ? "josh" : payload.alias,
        owner: payload.owner,
        moderator,
        banned,
      });
    }

    if (action === "send") {
      const token = getBearerToken(request);
      const payload = await verifyChatToken(token);

      if (!payload) {
        return json(
          {
            success: false,
            error: "Invalid or expired chat token.",
          },
          401,
        );
      }

      if (!payload.owner) {
        const currentAccount = await validateCurrentChatAccount(payload);

        if (!currentAccount) {
          return json(
            {
              success: false,
              error: "Chat identity no longer matches your current Flix2Watch account.",
            },
            401,
          );
        }
      }

      const alias = payload.owner ? "josh" : payload.alias.trim();

      if (!alias) {
        return json(
          {
            success: false,
            error: "Your chat identity does not have an alias.",
          },
          400,
        );
      }

      const message = String(body.message ?? "").trim();

      if (/\[\[image:/i.test(message)) {
        return json({ success: false, error: "Image sending is disabled in public chat." }, 400);
      }

      if (!message) {
        return json(
          { success: false, error: "Message cannot be empty." },
          400,
        );
      }

      if (message.length > 500) {
        return json(
          {
            success: false,
            error: "Message must be 500 characters or less.",
          },
          400,
        );
      }

      if (message.startsWith("/")) {
        const commandResult = await handleCommand(payload, message);

        return json(
          commandResult,
          commandResult.success ? 200 : 403,
        );
      }

      const moderationError = moderatePublicChatText(message);

      if (moderationError) {
        return json(
          {
            success: false,
            error: moderationError,
          },
          400,
        );
      }

      if (!payload.owner && (await isBanned(alias) || await isPublicChatBanned(alias))) {
        return json(
          {
            success: false,
            banned: true,
            error: "You are restricted from sending public chat messages.",
          },
          403,
        );
      }

      const moderator = payload.owner
        ? false
        : await isModerator(alias);

      const config = await getChatConfig();

      if (config.chat_locked && !payload.owner && !moderator) {
        return json(
          {
            success: false,
            error: "Chat is temporarily locked by Staff.",
          },
          403,
        );
      }

      const mute = payload.owner ? null : await getActiveMute(alias);

      if (mute) {
        return json(
          {
            success: false,
            error: mute.expires_at
              ? `You are muted until ${new Date(mute.expires_at).toLocaleString()}.`
              : "You are muted.",
          },
          403,
        );
      }

      if (message.includes("[[image:")) {
        return json(
          {
            success: false,
            error: "Image sending is disabled in public chat.",
          },
          403,
        );
      }

      // Permanent public-chat slow mode: EVERY account, including Owner/Staff/Mods.
      // DMs do not pass through this public-chat insert path and are not rate-limited.
      await enforcePublicChatSlowMode(payload.sub);

      const tokenHash = await sha256Hex(token);

      const insertPayload = {
        alias,
        message,
        user_token_hash: tokenHash,
        owner_id: payload.owner ? payload.sub : null,
        sender_user_id: payload.sub ?? null,
      };

      const { data, error } = await supabase
        .from("chat_messages")
        .insert(insertPayload)
        .select("id, alias, message, created_at, owner_id")
        .single();

      if (error) {
        console.error("Message insert failed:", error.message);

        return json(
          { success: false, error: error.message },
          500,
        );
      }

      return json({
        success: true,
        message: {
          id: data.id,
          alias: data.alias,
          message: data.message,
          created_at: data.created_at,
          owner:
            payload.owner ||
            normalizeAlias(data.alias) === "josh" ||
            Boolean(data.owner_id),
          moderator,
        },
      });
    }

    if (action === "delete") {
      const token = getBearerToken(request);
      const payload = await verifyChatToken(token);

      if (!payload) {
        return json(
          {
            success: false,
            error: "Invalid or expired chat token.",
          },
          401,
        );
      }

      if (!payload.owner) {
        const currentAccount = await validateCurrentChatAccount(payload);

        if (!currentAccount) {
          return json(
            {
              success: false,
              error: "Chat identity no longer matches your current Flix2Watch account.",
            },
            401,
          );
        }
      }

      const messageId = String(body.message_id ?? "").trim();

      if (!messageId) {
        return json(
          {
            success: false,
            error: "message_id is required.",
          },
          400,
        );
      }

      const moderator = payload.owner
        ? false
        : await isModerator(payload.alias);

      if (payload.owner || moderator) {
        const { data: existing } = await supabase
          .from("chat_messages")
          .select("message, alias, owner_id")
          .eq("id", messageId)
          .maybeSingle();

        if (
          moderator &&
          !payload.owner &&
          existing &&
          (
            normalizeAlias(String(existing.alias ?? "")) === "josh" ||
            Boolean(existing.owner_id)
          )
        ) {
          return json(
            {
              success: false,
              error: "Staff cannot delete Owner messages.",
            },
            403,
          );
        }

        const { error } = await supabase
          .from("chat_messages")
          .delete()
          .eq("id", messageId);

        if (error) {
          return json(
            { success: false, error: error.message },
            500,
          );
        }

        if (existing?.message) {
          await cleanupChatMedia(String(existing.message));
        }

        return json({ success: true, deleted: true });
      }

      const tokenHash = await sha256Hex(token);

      const { data: message, error: lookupError } = await supabase
        .from("chat_messages")
        .select("id, user_token_hash, sender_user_id, alias, message")
        .eq("id", messageId)
        .maybeSingle();

      if (lookupError) {
        return json(
          { success: false, error: lookupError.message },
          500,
        );
      }

      if (!message) {
        return json(
          { success: false, error: "Message not found." },
          404,
        );
      }

      if (message.sender_user_id !== payload.sub && message.user_token_hash !== tokenHash && normalizeAlias(String(message.alias ?? "")) !== normalizeAlias(String(payload.alias ?? ""))) {
        return json(
          {
            success: false,
            error: "You can only delete your own messages.",
          },
          403,
        );
      }

      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId);

      if (deleteError) {
        return json(
          { success: false, error: deleteError.message },
          500,
        );
      }

      if (message.message) {
        await cleanupChatMedia(String(message.message));
      }

      return json({ success: true, deleted: true });
    }

    return json(
      { success: false, error: "Unknown action." },
      400,
    );
  } catch (error) {
    console.error("rapid-worker error:", error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500,
    );
  }
});
// f2w-force-save:ban-evasion-worker-v1:1788212206
// f2w-force-save:cumulative-worker-v17:1788213599
// f2w-force-save:hard-chat24-cleanup-v31:1788217048
// f2w-force-save:worker-fast-request-path-v34:1788217565
// f2w-force-save:public-chat-slowmode-v37:1788218042
// f2w-force-save:strict-ban-evasion-v39:1788218599
 