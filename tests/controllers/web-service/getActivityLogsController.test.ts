import getActivityLogsController from "@/controllers/web-service/getActivityLogsController";
import { StatusCode } from "@/types/types";

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    activityLogs: { userId: "userId", createdAt: "createdAt" } // Mock fields used
}));
jest.mock("drizzle-orm", () => ({
    desc: jest.fn(),
    eq: jest.fn()
}));

describe("getActivityLogsController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return activity logs", async () => {
        mockDb.limit.mockResolvedValue([{ id: 1, log: "test" }]);
        const result = await getActivityLogsController({ userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "success", data: [{ id: 1, log: "test" }] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });

    it("should handle errors", async () => {
        mockDb.limit.mockRejectedValue(new Error("DB Error"));
        const result = await getActivityLogsController({ userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "Failed to fetch activity logs" });
        expect(mockSet.status).toBe(StatusCode.INTERNAL_SERVER_ERROR);
    });
});
