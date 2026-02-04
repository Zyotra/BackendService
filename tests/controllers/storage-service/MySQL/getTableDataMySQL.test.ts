import getMySQLTableData from "@/controllers/storage-service/MySQL/getTableDataMySQL";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockGetTableData = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        close: mockClose
    }));
});

jest.mock("@/HelperClasses/mySQLHelper", () => {
    return jest.fn().mockImplementation(() => ({
        getTableData: mockGetTableData
    }));
});

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("getMySQLTableData", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            databaseName: "mydb",
            tableName: "mytable",
            vpsId: "1",
            vpsIp: "1.2.3.4",
            username: "user",
            password: "pass"
        };
    });

    it("should return table data", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });
        mockGetTableData.mockResolvedValue([{ col: "val" }]);

        const result = await getMySQLTableData({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", data: [{ col: "val" }] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });
});
