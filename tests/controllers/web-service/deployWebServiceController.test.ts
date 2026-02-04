import deployWebServiceController from "@/controllers/web-service/deployWebServiceController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockConnect = jest.fn();
const mockRunSequential = jest.fn();
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

jest.mock("@/utils/getCredentials", () => jest.fn());
import getCredentials from "@/utils/getCredentials";

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("@/repoActions/cloneBuildRepo", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/startWebService", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/getRepoName", () => jest.fn().mockReturnValue("repo"));
jest.mock("@/repoActions/injectEnv", () => jest.fn().mockResolvedValue(true));
jest.mock("@/templates/nginxConfig", () => ({ getServerConfig: jest.fn(), getHttpServerConfig: jest.fn() }));
jest.mock("@/repoActions/injectNginxConfig", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/cleanDirectory", () => jest.fn());
jest.mock("@/repoActions/enableDomain", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/getPort", () => jest.fn().mockReturnValue(3000));
jest.mock("@/utils/saveActivity", () => jest.fn().mockResolvedValue(true));
jest.mock("@/utils/checkDomainValidity", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/cloneRepo", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/installDepedencies", () => jest.fn().mockResolvedValue(true));
jest.mock("@/ws/socketManager", () => ({ emitLog: jest.fn() }));
jest.mock("@/repoActions/saveLog", () => ({ saveLog: jest.fn() }));

describe("deployWebServiceController", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            vpsId: "1",
            repoUrl: "url",
            deploymentId: "dep1",
            packageInstallerCommand: "npm i",
            buildCommand: "npm run build",
            serverFilePath: "server.js",
            env: { PORT: "3000" },
            domain: "test.com",
            webServiceType: "node",
            framework: "node"
        };
    });

    it("should deploy web service successfully", async () => {
        (getCredentials as jest.Mock).mockResolvedValue({ vps_ip: "1.2.3.4", vps_password: "enc", ownerId: "1" });

        const result = await deployWebServiceController({ body: mockBody, set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "Deployment finished" });
        expect(mockConnect).toHaveBeenCalled();
        // Since we mocked all helpers to return true, it should pass through all steps
    });

    it("should fail validation if domain invalid", async () => {
        const { checkDomainValidity } = require("@/utils/checkDomainValidity"); // Re-import to mock return
        checkDomainValidity.mockResolvedValueOnce(false);

        const result = await deployWebServiceController({ body: mockBody, set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "The provided domain is not available.Domain might be already linked or invalid." });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });
});
