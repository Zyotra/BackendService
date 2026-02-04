import deleteMachine from "@/controllers/deployment-manager/Machines/deleteMachine";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
    delete: jest.fn().mockReturnThis(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: { id: "id" }
}));

jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
}));

describe("deleteMachine", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should delete machine if user is owner", async () => {
        const userId = "1";
        const params = { id: "100" };
        mockDb.where.mockResolvedValueOnce([{ id: 100, ownerId: 1 }]); // Select

        const result = await deleteMachine({ set: mockSet, params, userId } as any);

        expect(result).toEqual({ status: "success", message: "Machine deleted successfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should fail if machine not found", async () => {
        mockDb.where.mockResolvedValue([]);
        const result = await deleteMachine({ set: mockSet, params: { id: "99" }, userId: "1" } as any);

        expect(result).toMatchObject({ status: "error", message: "Machine not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });

    it("should fail if unauthorized", async () => {
        mockDb.where.mockResolvedValue([{ id: 100, ownerId: 2 }]); // Owner is 2
        const result = await deleteMachine({ set: mockSet, params: { id: "100" }, userId: "1" } as any);

        expect(result).toMatchObject({ status: "error", message: "Unauthorized to delete this machine" });
        expect(mockSet.status).toBe(StatusCode.UNAUTHORIZED);
    });
});
