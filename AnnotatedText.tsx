
import React from 'react';
import type { Span } from '../types';

interface AnnotatedTextProps {
  text: string;
  spans: Span[];
}

interface TextSegment {
    content: string;
    highlighted: boolean;
}

const AnnotatedText: React.FC<AnnotatedTextProps> = ({ text, spans }) => {
    if (spans.length === 0) {
        return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>;
    }

    const segments: TextSegment[] = [];
    let lastIndex = 0;

    spans.forEach(([start, end]) => {
        if (start > lastIndex) {
            segments.push({ content: text.substring(lastIndex, start), highlighted: false });
        }
        segments.push({ content: text.substring(start, end), highlighted: true });
        lastIndex = end;
    });

    if (lastIndex < text.length) {
        segments.push({ content: text.substring(lastIndex), highlighted: false });
    }

    return (
        <p className="whitespace-pre-wrap leading-relaxed">
            {segments.map((segment, index) => 
                segment.highlighted ? (
                    <span key={index} className="bg-yellow-500/20 text-yellow-300 rounded px-1 py-0.5">
                        {segment.content}
                    </span>
                ) : (
                    <React.Fragment key={index}>{segment.content}</React.Fragment>
                )
            )}
        </p>
    );
};

export default AnnotatedText;
