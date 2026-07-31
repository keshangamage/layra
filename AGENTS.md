<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Comments

Keep them short — one line, plain language. No multi-line block comments, no
JSDoc paragraphs, no ASCII diagrams, no restating what the code says.

Comment only what isn't obvious from reading the code: a non-obvious convention,
a sign choice, a reason. Otherwise leave it out.

```ts
// Left normal points into the room for CCW input.
export function leftNormal(dir: Vec2): Vec2 {
```
