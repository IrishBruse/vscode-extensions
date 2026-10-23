export const Commands = {
    OpenMarkdownInline: `inline-markdown-editor.openMarkdownInline`,

    OpenMarkdownSource: `inline-markdown-editor.openMarkdownSource`,

    OpenMermaidMarkdownPreview: `ib-utilities.openMermaidMarkdownPreview`,
} as const;

export type Commands = (typeof Commands)[keyof typeof Commands];
