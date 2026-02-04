import getProjectsController from "@/controllers/web-service/getProjectsController";
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
    deployments: { ownerId: "ownerId" }
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn()
}));

describe("getProjectsController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return projects", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, name: "project1" }]);
        const result = await getProjectsController({ userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "success", data: [{ id: 1, name: "project1" }] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });

    it("should handle errors", async () => {
        mockDb.where.mockRejectedValue(new Error("DB Error"));
        const result = await getProjectsController({ userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "An error occurred while fetching projects." });
        expect(mockSet.status).toBe(StatusCode.INTERNAL_SERVER_ERROR);
    });
});
