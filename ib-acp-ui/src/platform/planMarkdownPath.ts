/** Folder name under `~/.cursor/plans` for one create-plan request. */
export function planMarkdownDirectoryName(name: string | undefined, requestId: string): string {
    const slug = (name ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    const id = requestId
        .replace(/[^a-z0-9]/gi, "")
        .slice(-8)
        .toLowerCase();
    if (slug.length === 0) {
        return id.length > 0 ? id : "plan";
    }
    return id.length > 0 ? `${slug}-${id}` : slug;
}
