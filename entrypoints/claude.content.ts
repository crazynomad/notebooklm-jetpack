// Content script for extracting Claude conversations
import type { ClaudeConversation, ClaudeMessage } from '@/lib/types';

export default defineContentScript({
  matches: ['https://claude.ai/*'],
  runAt: 'document_idle',

  main() {
    console.log('Claude conversation extractor loaded');

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'EXTRACT_CONVERSATION') {
        extractConversation()
          .then((data) => sendResponse({ success: true, data }))
          .catch((error) => {
            console.error('Extraction error:', error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : '提取失败',
            });
          });
        return true; // Will respond asynchronously
      }
    });
  },
});

async function extractConversation(): Promise<ClaudeConversation> {
  // Extract conversation title
  const title = extractTitle();

  // Extract messages
  const messages = extractMessages();

  if (messages.length === 0) {
    throw new Error('未找到对话消息，请确保在 Claude 对话页面');
  }

  return {
    id: extractConversationId(),
    title,
    url: window.location.href,
    messages,
    extractedAt: Date.now(),
  };
}

function extractConversationId(): string {
  // Try to get conversation ID from URL
  const match = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
  if (match) {
    return match[1];
  }
  // Fallback to timestamp-based ID
  return `claude-${Date.now()}`;
}

function extractTitle(): string {
  // Try multiple selectors for the conversation title
  const titleSelectors = [
    // Title in header/sidebar
    '[data-testid="conversation-title"]',
    'h1[data-testid="chat-title"]',
    // Breadcrumb or header text
    'header h1',
    'nav [aria-current="page"]',
    // Fallback: first message truncated
    '.conversation-title',
  ];

  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }

  // Fallback: use page title or generic name
  if (document.title && !document.title.includes('Claude')) {
    return document.title;
  }

  return 'Claude 对话';
}

function extractMessages(): ClaudeMessage[] {
  const messages: ClaudeMessage[] = [];

  // Try multiple selector strategies for message containers
  const messageContainers = findMessageContainers();

  for (let i = 0; i < messageContainers.length; i++) {
    const container = messageContainers[i];
    const message = parseMessageContainer(container, i);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

function findMessageContainers(): Element[] {
  // Strategy 1: data-testid based selectors
  const testIdSelectors = [
    '[data-testid="user-message"]',
    '[data-testid="assistant-message"]',
    '[data-testid="human-turn"]',
    '[data-testid="assistant-turn"]',
  ];

  for (const selector of testIdSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      return Array.from(elements);
    }
  }

  // Strategy 2: Role-based selectors (common pattern)
  const roleSelectors = [
    '[data-message-role]',
    '[data-role]',
    '[class*="message"][class*="human"], [class*="message"][class*="assistant"]',
  ];

  for (const selector of roleSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    } catch {
      // Invalid selector, continue
    }
  }

  // Strategy 3: Conversation turn containers
  const conversationSelectors = [
    '[class*="ConversationTurn"]',
    '[class*="turn-container"]',
    '[class*="chat-message"]',
    '.prose', // Claude often uses prose class for messages
  ];

  for (const selector of conversationSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length >= 2) {
        // At least human + assistant
        return Array.from(elements);
      }
    } catch {
      // Continue
    }
  }

  // Strategy 4: Find alternating message pattern in main content
  const mainContent = document.querySelector('main') || document.body;
  const candidates = mainContent.querySelectorAll(
    '[class*="message"], [class*="Message"], article, [role="article"]'
  );
  if (candidates.length >= 2) {
    return Array.from(candidates);
  }

  return [];
}

function parseMessageContainer(
  container: Element,
  index: number
): ClaudeMessage | null {
  // Determine role
  const role = determineRole(container, index);
  if (!role) return null;

  // Extract content
  const content = extractContent(container);
  if (!content) return null;

  // Extract timestamp if available
  const timestamp = extractTimestamp(container);

  return {
    id: `msg-${index}`,
    role,
    content,
    timestamp,
  };
}

function determineRole(
  container: Element,
  index: number
): 'human' | 'assistant' | null {
  // Check data attributes
  const roleAttr =
    container.getAttribute('data-message-role') ||
    container.getAttribute('data-role') ||
    container.getAttribute('data-testid');

  if (roleAttr) {
    const lowerRole = roleAttr.toLowerCase();
    if (
      lowerRole.includes('human') ||
      lowerRole.includes('user') ||
      lowerRole === 'user-message'
    ) {
      return 'human';
    }
    if (
      lowerRole.includes('assistant') ||
      lowerRole.includes('claude') ||
      lowerRole === 'assistant-message'
    ) {
      return 'assistant';
    }
  }

  // Check class names
  const className = container.className.toLowerCase();
  if (className.includes('human') || className.includes('user')) {
    return 'human';
  }
  if (className.includes('assistant') || className.includes('claude')) {
    return 'assistant';
  }

  // Check for visual indicators (avatar, icon)
  const hasUserAvatar = container.querySelector(
    '[class*="user-avatar"], [class*="UserAvatar"], [alt*="User"]'
  );
  const hasClaudeAvatar = container.querySelector(
    '[class*="claude"], [class*="Claude"], [alt*="Claude"]'
  );

  if (hasUserAvatar) return 'human';
  if (hasClaudeAvatar) return 'assistant';

  // Fallback: alternate based on index (conversations typically start with human)
  return index % 2 === 0 ? 'human' : 'assistant';
}

function extractContent(container: Element): string | null {
  // Try to find the actual message content area
  const contentSelectors = [
    '[class*="message-content"]',
    '[class*="MessageContent"]',
    '.prose',
    '[class*="markdown"]',
    '[class*="Markdown"]',
    'p',
  ];

  for (const selector of contentSelectors) {
    const contentEl = container.querySelector(selector);
    if (contentEl?.textContent?.trim()) {
      return cleanContent(contentEl);
    }
  }

  // Fallback: use container text directly
  const text = container.textContent?.trim();
  if (text && text.length > 0) {
    return text;
  }

  return null;
}

function cleanContent(element: Element): string {
  // Clone to avoid modifying the DOM
  const clone = element.cloneNode(true) as Element;

  // Remove button/action elements
  clone.querySelectorAll('button, [role="button"]').forEach((el) => el.remove());

  // Get text content, preserving some structure
  let text = '';
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const nodeText = node.textContent || '';
    text += nodeText;
  }

  return text.trim();
}

function extractTimestamp(container: Element): string | undefined {
  // Look for timestamp elements
  const timeSelectors = ['time', '[datetime]', '[class*="timestamp"]', '[class*="time"]'];

  for (const selector of timeSelectors) {
    const timeEl = container.querySelector(selector);
    if (timeEl) {
      const datetime =
        timeEl.getAttribute('datetime') || timeEl.textContent?.trim();
      if (datetime) {
        return datetime;
      }
    }
  }

  return undefined;
}
