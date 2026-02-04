import deployUIController from "@/controllers/ui-service/deployUIController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockConnect = jest.fn();
const mockExec = jest.fn();
const mockRunSequential = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        exec: mockExec,
        runSequential: mockRunSequential,
        close: mockClose
    }));
});

jest.mock("@/utils/getCredentials", () => jest.fn());
import getCredentials from "@/utils/getCredentials";

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("@/repoActions/cloneBuildRepo", () => jest.fn().mockResolvedValue(true)); // For non-plainhtml
jest.mock("@/repoActions/getRepoName", () => jest.fn().mockReturnValue("repo"));
jest.mock("@/repoActions/injectEnv", () => jest.fn().mockResolvedValue(true));
jest.mock("@/templates/nginxConfig", () => ({ getServerConfigFrontend: jest.fn() }));
jest.mock("@/repoActions/injectNginxConfig", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/cleanDirectory", () => jest.fn());
jest.mock("@/repoActions/enableDomain", () => jest.fn().mockResolvedValue(true));
jest.mock("@/utils/saveActivity", () => jest.fn().mockResolvedValue(true));
jest.mock("@/utils/checkDomainValidity", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/cloneRepo", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/copyAssets", () => jest.fn().mockResolvedValue(true));
jest.mock("@/repoActions/installDepedencies", () => jest.fn().mockResolvedValue(true));
jest.mock("@/ws/socketManager", () => ({ emitLog: jest.fn() }));

describe("deployUIController", () => {
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
            outDir: "dist",
            env: {},
            domain: "test.com",
            webServiceType: "react",
            framework: "react",
            sourceDir: ""
        };
    });

    it("should deploy UI project successfully", async () => {
        (getCredentials as jest.Mock).mockResolvedValue({ vps_ip: "1.2.3.4", vps_password: "enc", ownerId: "1" });

        const result = await deployUIController({ body: mockBody, set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "Deployment finished" });
        expect(mockConnect).toHaveBeenCalled();
        // Since mocks return true, it should succeed
    });

    it("should fail validation if invalid framework", async () => {
        mockBody.framework = "invalid";
        const result = await deployUIController({ body: mockBody, set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "Invalid project type for UI deployment." });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });
});
