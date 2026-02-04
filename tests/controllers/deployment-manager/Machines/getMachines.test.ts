import getMachines from "@/controllers/deployment-manager/Machines/getMachines";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: { ownerId: "ownerId" }
}));

jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
}));

describe("getMachines", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return machines for valid user", async () => {
        const userId = "1";
        const mockMachines = [{ id: 1, name: "VPS 1" }];
        mockDb.where.mockResolvedValue(mockMachines);

        const result = await getMachines({ userId, set: mockSet } as any);

        expect(result).toEqual({ status: "success", data: mockMachines });
        expect(mockSet.status).toBe(StatusCode.OK);
    });

    it("should fail if no userId", async () => {
        const result = await getMachines({ userId: undefined, set: mockSet } as any);

        expect(result).toEqual({ status: "error", message: "Unauthorized. No user is associated with the request" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
