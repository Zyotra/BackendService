import addMachine from "@/controllers/deployment-manager/Machines/addMachines";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockDb = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: {}
}));

jest.mock("@/crypto/encryptVpsPassword", () => jest.fn().mockReturnValue("encrypted_secret"));

describe("addMachine", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            vpsIP: "1.2.3.4",
            vpsName: "My VPS",
            vpsPassword: "password",
            ram: 4,
            cpuCores: 2,
            storage: 50,
            region: "us-east",
            expiryDate: "2025-01-01"
        };
    });

    it("should add a new machine successfully", async () => {
        const userId = "1";
        const newMachineMock = { id: 1, ...mockBody };
        mockDb.returning.mockResolvedValue(newMachineMock);

        const result = await addMachine({ set: mockSet, body: mockBody, userId } as any);

        expect(result).toEqual({ status: "success", data: newMachineMock });
        expect(mockSet.status).toBe(StatusCode.CREATED);
        expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should fail if no userId", async () => {
        const result = await addMachine({ set: mockSet, body: mockBody, userId: undefined } as any);

        expect(result).toEqual({ status: "error", message: "Unauthorized.No user is associated with the request" });
        expect(mockSet.status).toBe(StatusCode.UNAUTHORIZED);
    });

    it("should fail if missing required fields", async () => {
        mockBody.vpsIP = "";
        const userId = "1";
        const result = await addMachine({ set: mockSet, body: mockBody, userId } as any);

        expect(result).toEqual({ status: "error", message: "Missing required fields" });
        expect(mockSet.status).toBe(StatusCode.FORBIDDEN);
    });

    it("should handle DB errors", async () => {
        mockDb.returning.mockRejectedValue(new Error("DB Error"));
        const userId = "1";

        const result = await addMachine({ set: mockSet, body: mockBody, userId } as any);

        expect(result).toMatchObject({ status: "error", message: "Failed to add new machine" });
        expect(mockSet.status).toBe(StatusCode.INTERNAL_SERVER_ERROR);
    });
});
