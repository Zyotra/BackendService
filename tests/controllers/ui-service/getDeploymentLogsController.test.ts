import getDeploymentLogController from "@/controllers/ui-service/getDeploymentLogsController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockConnect = jest.fn();
const mockExec = jest.fn();
const mockClose = jest.fn(); // Though close isn't called in the original code snippet (but should be eventually), wait, checking original code...
// original code: `const ssh = new SSHClient(...) ... const log = await ssh.exec(...)` 
// It does NOT call ssh.close() in finally block in the provided snippet! It just returns.
// This is a potential bug in source code (resource leak).
// But for testing, we just mock what is there.

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        exec: mockExec
    }));
});

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn()
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    deployments: {},
    vpsMachines: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn()
}));

// Note: Source code doesn't import decryptVpsPassword?
// Waiting... checking the viewed file `src/controllers/ui-service/getDeploymentLogsController.ts`
// Line 28: `password: vpsMachine[0].vps_password` - It passes the raw password!
// It does NOT use `decryptVpsPassword`. This might be a bug or intent.
// I won't mock decryptVpsPassword since it's not used.

describe("getDeploymentLogController (UI)", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return deployment logs", async () => {
        mockDb.where
            .mockResolvedValueOnce([{ vpsIp: "1.2.3.4" }]) // Project
            .mockResolvedValueOnce([{ vps_ip: "1.2.3.4", vps_password: "enc" }]); // VPS

        mockExec.mockResolvedValue({ output: "Log content" });

        const result = await getDeploymentLogController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "success", log: "Log content" });
        expect(mockSet.status).toBe(StatusCode.OK);
    });

    it("should fail if project not found", async () => {
        mockDb.where.mockResolvedValueOnce([]);
        const result = await getDeploymentLogController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Project not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
