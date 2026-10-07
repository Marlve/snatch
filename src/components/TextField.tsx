import { useEffect, useState } from "react";
import { Text, type Key } from "ink";

export type TextValue = { text: string; cursor: number };

export const EMPTY: TextValue = { text: "", cursor: 0 };
export const textOf = (text: string): TextValue => ({ text, cursor: text.length });

// Text and cursor change together, so a fast burst of keys never edits at a stale position.
// Left and Right move the cursor, Backspace and Delete remove, printable keys (or a paste) insert.
// Any other key returns the value unchanged.
export function editText(value: TextValue, input: string, key: Key, maxLength = Infinity): TextValue {
  const { text, cursor } = value;
  if (key.leftArrow) return { text, cursor: Math.max(0, cursor - 1) };
  if (key.rightArrow) return { text, cursor: Math.min(text.length, cursor + 1) };
  if (key.backspace) {
    return cursor === 0 ? value : { text: text.slice(0, cursor - 1) + text.slice(cursor), cursor: cursor - 1 };
  }
  if (key.delete) {
    return cursor >= text.length ? value : { text: text.slice(0, cursor) + text.slice(cursor + 1), cursor };
  }
  if (input && !key.ctrl && !key.meta && !key.tab && !key.escape && !key.return) {
    const typed = input.replace(/[\u0000-\u001f\u007f]/g, "");
    if (typed === "") return value;
    const next = (text.slice(0, cursor) + typed + text.slice(cursor)).slice(0, maxLength);
    return { text: next, cursor: Math.min(cursor + typed.length, next.length) };
  }
  return value;
}

// A non-breaking space is the cursor's cell at the end of the text: a plain space would be
// trimmed when the line wraps, and the line count would change on every blink.
const END_CELL = " ";
const BLINK_MS = 530;

type TextFieldProps = { value: TextValue; focused: boolean; placeholder: string };

// A text input: while focused the text is bold white, with a blinking block on the
// character under the cursor. Unfocused it is plain text, so the two states are easy to tell apart.
export function TextField({ value, focused, placeholder }: TextFieldProps) {
  const [on, setOn] = useState(true);
  // Every edit or move restarts the blink, so the cursor stays solid while typing.
  useEffect(() => {
    setOn(true);
    if (!focused) return;
    const timer = setInterval(() => setOn((v) => !v), BLINK_MS);
    return () => clearInterval(timer);
  }, [focused, value.text, value.cursor]);

  const { text, cursor } = value;
  const style = focused ? { bold: true, color: "#ffffff" } : {};
  const cell = (ch: string) => (
    <Text {...style} inverse={focused && on}>
      {ch}
    </Text>
  );

  if (text === "") {
    // The cursor sits on the placeholder's first letter instead of in front of it, so the
    // placeholder doesn't shift when the field gains or loses focus.
    if (!focused) return <Text dimColor>{placeholder}</Text>;
    return (
      <Text>
        {cell(placeholder[0] ?? END_CELL)}
        <Text dimColor>{placeholder.slice(1)}</Text>
      </Text>
    );
  }
  if (!focused) return <Text>{text}</Text>;
  return (
    <Text>
      <Text {...style}>{text.slice(0, cursor)}</Text>
      {cell(text[cursor] ?? END_CELL)}
      <Text {...style}>{text.slice(cursor + 1)}</Text>
    </Text>
  );
}
