import { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import type { QAPair } from '@/lib/types';

interface ShareCardData {
  pairs: QAPair[];
  title: string;
  platform: string;
  platformIcon: string;
  url: string;
}

const THEMES = {
  claude: {
    bg: 'linear-gradient(135deg, #2D1B0E 0%, #1A1008 100%)',
    accent: '#D97706',
    questionBg: 'rgba(217, 119, 6, 0.08)',
    questionBorder: 'rgba(217, 119, 6, 0.2)',
    answerBg: 'rgba(255, 255, 255, 0.04)',
    answerBorder: 'rgba(255, 255, 255, 0.08)',
    text: '#F5E6D3',
    textMuted: '#A89279',
    label: '#D97706',
  },
  chatgpt: {
    bg: 'linear-gradient(135deg, #0D1B0E 0%, #081208 100%)',
    accent: '#10A37F',
    questionBg: 'rgba(16, 163, 127, 0.08)',
    questionBorder: 'rgba(16, 163, 127, 0.2)',
    answerBg: 'rgba(255, 255, 255, 0.04)',
    answerBorder: 'rgba(255, 255, 255, 0.08)',
    text: '#D3F5E6',
    textMuted: '#79A892',
    label: '#10A37F',
  },
  gemini: {
    bg: 'linear-gradient(135deg, #0E1A2D 0%, #08101A 100%)',
    accent: '#4285F4',
    questionBg: 'rgba(66, 133, 244, 0.08)',
    questionBorder: 'rgba(66, 133, 244, 0.2)',
    answerBg: 'rgba(255, 255, 255, 0.04)',
    answerBorder: 'rgba(255, 255, 255, 0.08)',
    text: '#D3E3F5',
    textMuted: '#7992A8',
    label: '#4285F4',
  },
} as const;

type ThemeKey = keyof typeof THEMES;

export function ShareCardApp() {
  const [data, setData] = useState<ShareCardData | null>(null);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chrome.storage.local.get('shareCardData', (result) => {
      if (result.shareCardData) {
        setData(result.shareCardData);
        // Clean up after reading
        chrome.storage.local.remove('shareCardData');
      }
    });
  }, []);

  const themeKey = (data?.platform as ThemeKey) || 'claude';
  const theme = THEMES[themeKey] || THEMES.claude;

  const handleSave = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `${data?.title || 'share-card'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to save card:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <div className="loading">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Toolbar */}
      <div className="toolbar">
        <button onClick={handleSave} disabled={saving} className="save-btn">
          {saving ? 'Saving...' : '💾 Save as PNG'}
        </button>
        <span className="hint">3x resolution for crisp sharing</span>
      </div>

      {/* Card preview */}
      <div className="card-wrapper">
        <div
          ref={cardRef}
          className="card"
          style={{ background: theme.bg }}
        >
          {/* Header */}
          <div className="card-header">
            <span className="platform-icon">{data.platformIcon}</span>
            <div className="header-text">
              <h1 style={{ color: theme.text }}>{data.title}</h1>
              <p style={{ color: theme.textMuted }}>{data.platform}</p>
            </div>
          </div>

          {/* Q&A pairs */}
          <div className="pairs">
            {data.pairs.map((pair, i) => (
              <div key={pair.id} className="pair">
                {pair.question && (
                  <div
                    className="bubble question"
                    style={{
                      background: theme.questionBg,
                      borderColor: theme.questionBorder,
                    }}
                  >
                    <span className="role-label" style={{ color: theme.label }}>Q</span>
                    <p style={{ color: theme.text }}>{pair.question}</p>
                  </div>
                )}
                {pair.answer && (
                  <div
                    className="bubble answer"
                    style={{
                      background: theme.answerBg,
                      borderColor: theme.answerBorder,
                    }}
                  >
                    <span className="role-label" style={{ color: theme.textMuted }}>A</span>
                    <p style={{ color: theme.text }}>{formatAnswer(pair.answer)}</p>
                  </div>
                )}
                {i < data.pairs.length - 1 && (
                  <div className="divider" style={{ borderColor: theme.answerBorder }} />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="card-footer" style={{ borderColor: theme.answerBorder }}>
            <span style={{ color: theme.textMuted }}>NotebookLM Jetpack</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Truncate long answers for card display */
function formatAnswer(text: string): string {
  // Remove markdown formatting for cleaner card display
  let clean = text
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n');

  if (clean.length > 600) {
    clean = clean.slice(0, 600).trimEnd() + '...';
  }
  return clean;
}
