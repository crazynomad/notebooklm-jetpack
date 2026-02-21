import { describe, it, expect } from 'vitest';
import { formatConversationForImport } from '@/services/claude-conversation';
import type { ClaudeConversation } from '@/lib/types';

const mockConversation: ClaudeConversation = {
  id: 'conv-123',
  title: '测试对话',
  url: 'https://claude.ai/chat/conv-123',
  extractedAt: 1708560000000,
  messages: [
    { id: 'msg-0', role: 'human', content: '你好，请帮我写一段代码' },
    { id: 'msg-1', role: 'assistant', content: '好的，这是一段示例代码：\n```js\nconsole.log("hello")\n```', timestamp: '2024-02-22 10:00' },
    { id: 'msg-2', role: 'human', content: '谢谢，能加个注释吗？' },
    { id: 'msg-3', role: 'assistant', content: '当然，已添加注释。' },
  ],
};

describe('formatConversationForImport', () => {
  it('formats selected messages correctly', () => {
    const result = formatConversationForImport(mockConversation, ['msg-0', 'msg-1']);

    expect(result).toContain('# 测试对话');
    expect(result).toContain('**来源**: Claude 对话');
    expect(result).toContain('https://claude.ai/chat/conv-123');
    expect(result).toContain('👤 Human');
    expect(result).toContain('🤖 Claude');
    expect(result).toContain('你好，请帮我写一段代码');
    expect(result).toContain('console.log("hello")');
  });

  it('includes timestamp when available', () => {
    const result = formatConversationForImport(mockConversation, ['msg-1']);
    expect(result).toContain('2024-02-22 10:00');
  });

  it('excludes unselected messages', () => {
    const result = formatConversationForImport(mockConversation, ['msg-0']);
    expect(result).not.toContain('示例代码');
    expect(result).not.toContain('🤖 Claude');
  });

  it('handles all messages selected', () => {
    const result = formatConversationForImport(
      mockConversation,
      ['msg-0', 'msg-1', 'msg-2', 'msg-3']
    );
    expect(result).toContain('你好，请帮我写一段代码');
    expect(result).toContain('示例代码');
    expect(result).toContain('加个注释');
    expect(result).toContain('已添加注释');
  });

  it('throws when no messages selected', () => {
    expect(() => formatConversationForImport(mockConversation, [])).toThrow('未选择任何消息');
  });

  it('throws when selected IDs do not match any messages', () => {
    expect(() => formatConversationForImport(mockConversation, ['nonexistent'])).toThrow('未选择任何消息');
  });
});
