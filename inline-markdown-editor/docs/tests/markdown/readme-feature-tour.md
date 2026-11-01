# Inline Markdown preview

Your file stays plain Markdown on disk.
Headings, emphasis, links, and lists render with your color theme until you click to edit source.

## Lists and tasks

- **Bold**, _italic_, ~~strike~~, and `inline code`
- [Example link](https://example.com)
- Nested items
    - Child bullet

- [ ] Unchecked task
- [x] Completed task

## Tables

| Name  | Role         | Notes                                      |
| :---- | :----------- | :----------------------------------------- |
| Ada   | **Engineer** | `inline` and a [link](https://example.com) |
| Grace | Architect    | Wide text wraps in the cell                |

## Code

```typescript
export function greet(name: string): string {
    return `Hello, ${name}!`;
}
```
