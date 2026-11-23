import { describe, expect, it } from "vite-plus/test";
import { LatestPromptTurn } from "./latestPromptTurn";

describe("LatestPromptTurn", () => {
    it("runs one turn to completion", async () => {
        const turns = new LatestPromptTurn();
        let finished = false;
        await turns.run(
            async () => undefined,
            async (isCurrent) => {
                finished = isCurrent();
            },
        );
        expect(finished).toBe(true);
    });

    it("starts the next turn while the previous one is still running", async () => {
        const turns = new LatestPromptTurn();
        let releaseFirst: () => void = () => undefined;
        const firstBlocked = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        const started: number[] = [];
        let cancels = 0;

        const first = turns.run(
            async () => undefined,
            async (isCurrent) => {
                started.push(1);
                await firstBlocked;
                if (isCurrent()) {
                    started.push(1);
                }
            },
        );
        await Promise.resolve();

        const second = turns.run(
            async () => {
                cancels += 1;
            },
            async (isCurrent) => {
                started.push(2);
                if (!isCurrent()) {
                    started.push(0);
                }
            },
        );

        await second;
        expect(cancels).toBe(1);
        expect(started).toEqual([1, 2]);
        releaseFirst();
        await first;
        expect(started).toEqual([1, 2]);
    });

    it("drops a turn that was replaced while cancel was in flight", async () => {
        const turns = new LatestPromptTurn();
        let releaseCancel: () => void = () => undefined;
        const cancelBlocked = new Promise<void>((resolve) => {
            releaseCancel = resolve;
        });
        const started: number[] = [];

        const second = turns.run(
            async () => undefined,
            async () => {
                started.push(1);
            },
        );
        await second;

        const replaced = turns.run(
            async () => {
                await cancelBlocked;
            },
            async () => {
                started.push(2);
            },
        );
        const latest = turns.run(
            async () => undefined,
            async () => {
                started.push(3);
            },
        );
        releaseCancel();
        await Promise.all([replaced, latest]);
        expect(started).toEqual([1, 3]);
    });

    it("keeps later turns running after an earlier turn throws", async () => {
        const turns = new LatestPromptTurn();
        const failed = turns.run(
            async () => undefined,
            async () => {
                throw new Error("boom");
            },
        );
        await expect(failed).rejects.toThrow("boom");
        let ran = false;
        await turns.run(
            async () => undefined,
            async () => {
                ran = true;
            },
        );
        expect(ran).toBe(true);
    });
});
