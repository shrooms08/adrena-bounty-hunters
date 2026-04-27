// Runtime length validator for decoded Adrena program events.
//
// If Adrena ships a program upgrade that changes event layout again, the
// Borsh coder can still succeed on a subset of fields while silently
// misinterpreting the rest. Comparing raw payload length against the
// release/39 expected size gives us an early signal — a mismatch means
// the IDL we're decoding against is out of date and any fields past the
// first drift are unreliable.

// Sizes include the 8-byte discriminator. Derived from release/39 schema:
//   ClosePositionEvent = 8 + 3*32 + 32 + 1 + 9*8 + 16 + 1 = 226
//   OpenPositionEvent  = 8 + 3*32 + 32 + 1 + 3*8 + 4 + 8 + 1 = 174
const EXPECTED_EVENT_BYTES: Record<string, number> = {
  ClosePositionEvent: 226,
  OpenPositionEvent: 174,
};

const warned = new Set<string>();

export function checkEventBytes(eventName: string, rawBytes: number): void {
  const expected = EXPECTED_EVENT_BYTES[eventName];
  if (expected === undefined) return;
  if (rawBytes === expected) return;

  const key = `${eventName}:${rawBytes}`;
  if (warned.has(key)) return;
  warned.add(key);

  console.error(
    `[adrena-schema] WARNING: ${eventName} payload is ${rawBytes} bytes, ` +
      `expected ${expected}. The IDL at adrena-reference/adrena-abi (release/39) ` +
      `may be out of date vs. the deployed program. Decoded fields past the ` +
      `mismatch point are unreliable.`,
  );
}
