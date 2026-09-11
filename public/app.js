/**
 * NEERAJ AI streaming client.
 * The React UI can call window.transmitPromptToAsyncStream(text, onToken).
 */
(function attachStreamingClient() {
  const configuredBase = String(window.NEERAJ_API_BASE_URL || '').replace(/\/$/, '');

  async function transmitPromptToAsyncStream(rawInputText, onToken) {
    const prompt = String(rawInputText || '').trim();
    if (!prompt) return '';

    const targetEndpoint = `${configuredBase}/api/v1/chat/stream`;
    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ user_prompt: prompt, session_id: 'NEERAJ-WEB' }),
    });

    if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
    if (!response.body) throw new Error('Streaming response body is unavailable');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let completeMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const line = frame.split('\n').find((entry) => entry.startsWith('data:'));
        if (!line) continue;
        const token = line.slice(5).trimStart();
        if (token === '[DONE]') continue;
        completeMessage += token;
        if (typeof onToken === 'function') onToken(token, completeMessage);
      }
    }

    return completeMessage.trim();
  }

  window.transmitPromptToAsyncStream = transmitPromptToAsyncStream;
})();
