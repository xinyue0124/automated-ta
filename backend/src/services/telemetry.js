// One stats record per chat answer: time per stage, tokens, and the model that answered.
// Logged as a JSON line (LOG_CHAT_STATS=0 turns that off) and passed to in-process listeners,
// which the load test uses to break latency down by stage.
const listeners = new Set();

export function onChatStats(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function recordChatStats(stats) {
  if (process.env.LOG_CHAT_STATS !== '0') console.log(JSON.stringify({ event: 'chat', ...stats }));
  for (const fn of listeners) fn(stats);
}
