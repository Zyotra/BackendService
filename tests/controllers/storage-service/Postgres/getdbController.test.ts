import getdbController from "@/controllers/storage-service/Postgres/getdbController";
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
    deployed_db: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn()
}));

describe("getdbController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return dbs for user", async () => {
        mockDb.where.mockResolvedValue([{ id: 1 }]);
        const result = await getdbController({ userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: StatusCode.OK, data: [{ id: 1 }] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });
});
