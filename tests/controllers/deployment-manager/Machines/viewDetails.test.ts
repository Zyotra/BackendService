import viewDetails from "@/controllers/deployment-manager/Machines/viewDetails";
import { StatusCode } from "@/types/types";

// Mock SSH
const mockRunSequential = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        runSequential: mockRunSequential,
        close: mockClose
    }));
});

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: {}
}));

jest.mock("@/crypto/decryptVpsPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("viewDetails", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return machine details via SSH", async () => {
        const mockMachine = { id: 1, vps_ip: "1.2.3.4", vps_password: "enc" };
        mockDb.limit.mockResolvedValue([mockMachine]);

        mockRunSequential.mockResolvedValue([
            { output: "Memory Info" },
            { output: "Disk Info" },
            { output: "CPU Info" },
            { output: "OS Info" },
            { output: "Processes" }
        ]);

        const result = await viewDetails({ params: { id: "1" }, set: mockSet } as any);

        expect(result).toMatchObject({
            message: "Machine details fetched successfully",
            data: {
                memory: "Memory Info",
                disk: "Disk Info"
            }
        });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockConnect).toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
    });

    it("should fail if machine not found", async () => {
        mockDb.limit.mockResolvedValue([]);
        const result = await viewDetails({ params: { id: "1" }, set: mockSet } as any);
        expect(result).toMatchObject({ message: "No machine found with the provided ID" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
