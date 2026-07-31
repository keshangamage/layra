<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# No em dashes

Never use an em dash. Use a hyphen instead. This applies everywhere: code
comments, commit messages, UI copy, docs, and chat replies.

# Comments

Keep them short - one line, plain language. No multi-line block comments, no
JSDoc paragraphs, no ASCII diagrams, no restating what the code says.

Comment only what isn't obvious from reading the code: a non-obvious convention,
a sign choice, a reason. Otherwise leave it out.

```ts
// Left normal points into the room for CCW input.
export function leftNormal(dir: Vec2): Vec2 {
```

# Commit messages

Subject line plus at most two or three short lines of body. Say what changed,
not how it was built or why every decision was made. No bullet lists, no test
counts, no paragraphs.
