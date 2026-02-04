import getUsedPorts from "@/controllers/deployment-manager/portController";
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
    vpsMachines: { id: "vpsMachines.id", ownerId: "vpsMachines.ownerId", vps_password: "encrypted_pass", vps_ip: "1.2.3.4" }
}));

const mockSSHExec = jest.fn();
const mockSSHClose = jest.fn();
jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        exec: mockSSHExec,
        close: mockSSHClose
    }));
});

jest.mock("@/crypto/decryptVpsPassword", () => jest.fn().mockReturnValue("decrypted_password"));

jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn(),
}));

describe("portController - getUsedPorts", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return used ports for valid user and machine", async () => {
        const userId = "1";
        const params = { id: "100" };
        const mockMachine = { id: 100, ownerId: 1, vps_password: "enc", vps_ip: "1.2.3.4" };

        mockDb.where.mockResolvedValue([mockMachine]);
        mockSSHExec.mockResolvedValue("80\n443\n3000\n");

        const result = await getUsedPorts({ params, set: mockSet, userId } as any);

        expect(result).toEqual({
            status: "success",
            data: {
                vpsId: 100,
                usedPorts: [80, 443, 3000]
            }
        });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockSSHExec).toHaveBeenCalled();
        expect(mockSSHClose).toHaveBeenCalled();
    });

    it("should return error for invalid VPS ID", async () => {
        const params = { id: "invalid" };
        const result = await getUsedPorts({ params, set: mockSet, userId: "1" } as any);

        expect(result).toEqual({ status: "error", message: "Invalid VPS ID" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });

    it("should return error if machine not found", async () => {
        mockDb.where.mockResolvedValue([]);
        const params = { id: "100" };
        const result = await getUsedPorts({ params, set: mockSet, userId: "1" } as any);

        expect(result).toEqual({ status: "error", message: "Machine not found or unauthorized" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });

    it("should handle SSH errors", async () => {
        mockDb.where.mockResolvedValue([{ id: 100, vps_password: "enc" }]);
        mockSSHExec.mockRejectedValue(new Error("SSH connection failed"));

        const params = { id: "100" };
        const result = await getUsedPorts({ params, set: mockSet, userId: "1" } as any);

        expect(result).toMatchObject({ status: "error", message: "Failed to fetch used ports from machine" });
        expect(mockSet.status).toBe(StatusCode.INTERNAL_SERVER_ERROR);
    });
});
