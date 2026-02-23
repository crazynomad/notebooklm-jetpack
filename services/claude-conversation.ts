import type { ClaudeConversation, ClaudeMessage } from '@/lib/types';

// Extract Claude conversation from current tab
export async function extractClaudeConversation(
  tabId: number
): Promise<ClaudeConversation> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'EXTRACT_CONVERSATION' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.success) {
          reject(new Error(response?.error || '提取对话失败'));
          return;
        }
        resolve(response.data as ClaudeConversation);
      }
    );
  });
}

// Format selected messages for import to NotebookLM
export function formatConversationForImport(
  conversation: ClaudeConversation,
  selectedMessageIds: string[]
): string {
  const selectedMessages = conversation.messages.filter((msg) =>
    selectedMessageIds.includes(msg.id)
  );

  if (selectedMessages.length === 0) {
    throw new Error('未选择任何消息');
  }

  const lines: string[] = [];

  // Detect platform from URL
  const platform = conversation.url.includes('chatgpt.com') || conversation.url.includes('chat.openai.com')
    ? 'ChatGPT'
    : conversation.url.includes('gemini.google.com')
      ? 'Gemini'
      : 'Claude';

  // Header
  lines.push(`# ${conversation.title}`);
  lines.push('');
  lines.push(`**来源**: ${platform} 对话`);
  lines.push(`**URL**: ${conversation.url}`);
  lines.push(
    `**提取时间**: ${new Date(conversation.extractedAt).toLocaleString('zh-CN')}`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // Messages
  for (const message of selectedMessages) {
    const assistantLabel = platform === 'ChatGPT' ? 'ChatGPT' : platform === 'Gemini' ? 'Gemini' : 'Claude';
    const roleLabel = message.role === 'human' ? '👤 Human' : `🤖 ${assistantLabel}`;
    lines.push(`## ${roleLabel}`);
    if (message.timestamp) {
      lines.push(`*${message.timestamp}*`);
    }
    lines.push('');
    lines.push(message.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
