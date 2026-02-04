import getGithubStatusController from "@/controllers/deployment-manager/Github/getGithubStatusController";
import { StatusCode } from "@/types/types";

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    githubAuths: { vpsId: "vpsId" }
}));

jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
}));

describe("getGithubStatusController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return status if found", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, github_username: "user" }]);
        const result = await getGithubStatusController({ params: { id: "1" }, set: mockSet } as any);

        expect(result).toEqual({ status: "success", data: { id: 1, github_username: "user" } });
        expect(mockSet.status).toBe(StatusCode.OK);
    });

    it("should fail if not found", async () => {
        mockDb.where.mockResolvedValue([]);
        const result = await getGithubStatusController({ params: { id: "1" }, set: mockSet } as any);

        expect(result).toMatchObject({ status: "error", message: "No GitHub authentication found for the specified VPS" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
