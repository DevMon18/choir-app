export interface ReplySnippet {
  id: string;
  sender_name: string;
  body: string;
}

export function parseStoredMessage(raw: { body: string; reply_snippet?: any; reply_to_id?: any }): {
  cleanBody: string;
  replySnippet: ReplySnippet | null;
} {
  if (raw.reply_snippet) {
    return { cleanBody: raw.body, replySnippet: raw.reply_snippet };
  }
  if (typeof raw.body === 'string' && raw.body.startsWith('<!--reply:')) {
    const endIdx = raw.body.indexOf('-->');
    if (endIdx !== -1) {
      try {
        const jsonStr = raw.body.substring(10, endIdx);
        const snippet = JSON.parse(jsonStr) as ReplySnippet;
        const clean = raw.body.substring(endIdx + 3);
        return { cleanBody: clean, replySnippet: snippet };
      } catch {
        // Fallback
      }
    }
  }
  return { cleanBody: raw.body, replySnippet: null };
}

export function formatMessageTimestamp(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return timeStr;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Yesterday ${timeStr}`;
  }

  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 6) {
    const dayOfWeek = date.toLocaleDateString([], { weekday: 'short' });
    return `${dayOfWeek} ${timeStr}`;
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    const monthDay = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${monthDay} ${timeStr}`;
  }

  const fullDate = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fullDate} ${timeStr}`;
}

export function getDateSeparatorLabel(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
