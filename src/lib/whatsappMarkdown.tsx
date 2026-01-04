import React from 'react';

/**
 * Parse WhatsApp-style markdown formatting into React nodes
 * 
 * Supported formats:
 * - *bold* → <strong>
 * - _italic_ → <em>
 * - ~strikethrough~ → <del>
 * - `code` → <code>
 * - ```block``` → <pre>
 * - > quote → blockquote style
 * - * item or - item → bullet list
 * - 1. item → numbered list
 */

// Process inline formatting (bold, italic, strikethrough, code)
function parseInlineFormatting(text: string, keyPrefix: string = ''): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  
  // Combined regex for all inline formats
  // Order matters: block code > inline code > bold > italic > strikethrough
  const regex = /```([\s\S]+?)```|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;
  
  let lastIndex = 0;
  let match;
  let key = 0;
  
  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const uniqueKey = `${keyPrefix}-${key++}`;
    
    if (match[1] !== undefined) {
      // Block code ```
      parts.push(
        <pre key={uniqueKey} className="bg-background/20 px-2 py-1 rounded text-xs font-mono my-1 inline-block">
          {match[1]}
        </pre>
      );
    } else if (match[2] !== undefined) {
      // Inline code `
      parts.push(
        <code key={uniqueKey} className="bg-background/20 px-1 rounded text-xs font-mono">
          {match[2]}
        </code>
      );
    } else if (match[3] !== undefined) {
      // Bold *
      parts.push(<strong key={uniqueKey}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      // Italic _
      parts.push(<em key={uniqueKey}>{match[4]}</em>);
    } else if (match[5] !== undefined) {
      // Strikethrough ~
      parts.push(<del key={uniqueKey} className="opacity-70">{match[5]}</del>);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

// Main function to parse WhatsApp markdown
export function parseWhatsAppMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  
  lines.forEach((line, lineIndex) => {
    // Add line break between lines (except first)
    if (lineIndex > 0) {
      result.push(<br key={`br-${lineIndex}`} />);
    }
    
    const keyPrefix = `line-${lineIndex}`;
    
    // Check for quote (> text)
    if (line.startsWith('> ')) {
      const quoteContent = line.slice(2);
      result.push(
        <span 
          key={keyPrefix} 
          className="border-l-2 border-current/50 pl-2 italic opacity-80 inline-flex"
        >
          {parseInlineFormatting(quoteContent, keyPrefix)}
        </span>
      );
      return;
    }
    
    // Check for bullet list (* item or - item)
    const bulletMatch = line.match(/^[*-]\s+(.+)/);
    if (bulletMatch) {
      result.push(
        <span key={keyPrefix} className="flex gap-1">
          <span className="select-none">•</span>
          <span>{parseInlineFormatting(bulletMatch[1], keyPrefix)}</span>
        </span>
      );
      return;
    }
    
    // Check for numbered list (1. item)
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      result.push(
        <span key={keyPrefix} className="flex gap-1">
          <span className="select-none">{numberedMatch[1]}.</span>
          <span>{parseInlineFormatting(numberedMatch[2], keyPrefix)}</span>
        </span>
      );
      return;
    }
    
    // Regular line - apply inline formatting
    const inlineParts = parseInlineFormatting(line, keyPrefix);
    if (inlineParts.length === 1 && typeof inlineParts[0] === 'string') {
      // Simple string, no need for fragment
      result.push(inlineParts[0]);
    } else {
      result.push(
        <React.Fragment key={keyPrefix}>
          {inlineParts}
        </React.Fragment>
      );
    }
  });
  
  return result;
}
