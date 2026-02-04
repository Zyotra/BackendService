import deployLatestCommitController from "@/controllers/web-service/deployLatestCommitController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockRunSequential = jest.fn();
const mockConnect = jest.fn();
const mockExec = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        runSequential: mockRunSequential,
        exec: mockExec,
        close: mockClose
    }));
});

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn()
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    deployments: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn()
}));

jest.mock("@/utils/getMachineDetail", () => jest.fn());
import getMachineDetail from "@/utils/getMachineDetail";

jest.mock("@/repoActions/getRepoName", () => jest.fn().mockReturnValue("repo"));
jest.mock("@/repoActions/saveLog", () => ({ saveLog: jest.fn() }));
jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("deployLatestCommitController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should deploy latest commit successfully (node)", async () => {
        mockDb.limit.mockResolvedValueOnce([{
            deploymentId: "dep1",
            vpsIp: "1.2.3.4",
            repoUrl: "url",
            framework: "node",
            packageInstallerCommand: "npm install",
            domain: "test.com"
        }]);
        (getMachineDetail as jest.Mock).mockResolvedValue({ vps_ip: "1.2.3.4", vps_password: "enc" });

        const result = await deployLatestCommitController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "Deployment initiated" });
        expect(mockRunSequential).toHaveBeenCalled();
    });

    it("should deploy latest commit successfully (docker)", async () => {
        mockDb.limit.mockResolvedValueOnce([{
            deploymentId: "dep1",
            vpsIp: "1.2.3.4",
            repoUrl: "url",
            framework: "docker",
            domain: "test.com"
        }]);
        (getMachineDetail as jest.Mock).mockResolvedValue({ vps_ip: "1.2.3.4", vps_password: "enc" });
        mockExec.mockResolvedValue({ output: "PORT=3000\nCONTAINER_PORT=3000" });

        const result = await deployLatestCommitController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "Deployment initiated" });
        expect(mockRunSequential).toHaveBeenCalled();
    });

    it("should fail if deployment record not found", async () => {
        mockDb.limit.mockResolvedValueOnce([]); // Not found
        const result = await deployLatestCommitController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "Deployment record not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
