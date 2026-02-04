import getRedisServer from "@/controllers/storage-service/Redis/getRedisServer";
import { StatusCode } from "@/types/types";

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn()
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    caching: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn()
}));

describe("getRedisServer", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return redis servers", async () => {
        mockDb.where.mockResolvedValue([{ id: 1 }]);
        const result = await getRedisServer({ set: mockSet, userId: "1" } as any);
        expect(result).toMatchObject({ message: "Redis Server Fetched Successfully.", data: [{ id: 1 }] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });
});
