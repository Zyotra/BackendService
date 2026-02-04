import updateMachine from "@/controllers/deployment-manager/Machines/updateMachine";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: { id: "id" }
}));

jest.mock("@/crypto/encryptVpsPassword", () => jest.fn().mockReturnValue("encrypted_new_pass"));

describe("updateMachine", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {};
    });

    it("should update password", async () => {
        mockBody.newVpsPassword = "newPass";
        mockDb.where.mockResolvedValue([{ id: 1 }]); // Exists
        mockDb.where.mockResolvedValue([]); // For update call (drizzle mocking quirk, assume it returns promise)

        const result = await updateMachine({ set: mockSet, params: { id: "1" }, body: mockBody } as any);

        expect(result).toMatchObject({ status: "success" }); // Mocks might return undefined for updatedMachine
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockDb.update).toHaveBeenCalled();
        expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ vps_password: "encrypted_new_pass" }));
    });

    it("should fail if no fields to update", async () => {
        const result = await updateMachine({ set: mockSet, params: { id: "1" }, body: {} } as any);

        expect(result).toMatchObject({ status: "error", message: "Provide at least one field to update (newVpsPassword or expiryDate)" });
        expect(mockSet.status).toBe(StatusCode.FORBIDDEN);
    });
});
